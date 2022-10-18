import * as fs from 'fs';
import * as path from 'path';
import cpx from 'cpx';
import { sync as globSync } from 'glob';
import makeDir from 'make-dir';
import Zip from 'adm-zip';

import { log } from './logger';
import { Config } from './config';
import { Event } from './event';
import { findRunAndArtifact, RunClient } from './run';
import { compare, CompareOutput } from './compare';
import { createCommentWithTarget, createCommentWithoutTarget } from './comment';
import * as constants from './constants';
import { workspace } from './path';
import { REPORT_NAME } from './constants';
import { join } from 'path';

type DownloadClient = {
  downloadArtifact: (id: number) => Promise<{ data: unknown }>;
};

// Download expected images from target artifact.
const downloadExpectedImages = async (client: DownloadClient, latestArtifactId: number) => {
  const zip = await client.downloadArtifact(latestArtifactId);
  await Promise.all(
    new Zip(Buffer.from(zip.data as any))
      .getEntries()
      .filter(f => !f.isDirectory && f.entryName.startsWith(constants.ACTUAL_DIR_NAME))
      .map(async file => {
        const f = path.join(
          workspace(),
          file.entryName.replace(constants.ACTUAL_DIR_NAME, constants.EXPECTED_DIR_NAME),
        );
        await makeDir(path.dirname(f));
        await fs.promises.writeFile(f, file.getData());
      }),
  );
};

const copyImages = (imagePath: string) => {
  cpx.copySync(
    path.join(imagePath, `**/*.{png,jpg,jpeg,tiff,bmp,gif}`),
    path.join(workspace(), constants.ACTUAL_DIR_NAME),
  );
};

type UploadClient = {
  uploadArtifact: (files: string[]) => Promise<void>;
  uploadWebsite: (dir: string) => Promise<string>;
};

// Compare images and upload result.
const compareAndUpload = async (
  client: UploadClient,
  config: Config,
): Promise<CompareOutput & { reportUrl: string }> => {
  const result = await compare(config);
  log.debug('compare result', result);

  const files = globSync(path.join(workspace(), '**/*'));

  log.info('Start upload artifact');

  let reportUrl: string = '';
  try {
    await client.uploadArtifact(files);
    reportUrl = await client.uploadWebsite(join(workspace(), REPORT_NAME));
  } catch (e) {
    log.error(e);
    throw new Error('Failed to upload artifact');
  }
  log.info('Succeeded to upload artifact');

  return { ...result, reportUrl };
};

const init = async (config: Config) => {
  // Create workspace
  await makeDir(workspace());

  // Copy actual images
  copyImages(config.imageDirectoryPath);
};

type CommentClient = {
  postComment: (issueNumber: number, comment: string) => Promise<void>;
};

type Client = CommentClient & DownloadClient & UploadClient & RunClient;

export const run = async (event: Event, runId: number, sha: string, client: Client, config: Config) => {
  // Setup directory for artifact and copy images.
  await init(config);

  // If event is not pull request, upload images then finish actions.
  // This data is used as expected data for the next time.
  if (typeof event.number === 'undefined') {
    log.info(`event number is not detected.`);
    await compareAndUpload(client, config);
    return;
  }

  // Find current run and target run and artifact.
  const runAndArtifact = await findRunAndArtifact({ event, client, targetHash: config.targetHash });

  // If target artifact is not found, upload images.
  if (!runAndArtifact || !runAndArtifact.run || !runAndArtifact.artifact) {
    log.warn('Failed to find current or target runs');
    log.warn(`cwd: ${process.cwd()}`);
    log.warn(`dirname: ${__dirname}`);
    const result = await compareAndUpload(client, config);

    // If we have current run, add comment to PR.
    if (runId) {
      const comment = createCommentWithoutTarget({ event, runId, result });
      await client.postComment(event.number, comment);
    }
    return;
  }

  const { run: targetRun, artifact } = runAndArtifact;

  // Download and copy expected images to workspace.
  await downloadExpectedImages(client, artifact.id);

  const result = await compareAndUpload(client, config);

  const comment = createCommentWithTarget({ event, runId, sha, targetRun, result });

  await client.postComment(event.number, comment);
};
