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
import { pushImages } from './push';
import { targetDir } from './helper';

type DownloadClient = {
  downloadArtifact: (id: number) => Promise<{ data: unknown }>;
};

// Download expected images from target artifact.
const downloadExpectedImages = async (client: DownloadClient, latestArtifactId: number) => {
  log.info(`Start to download expected images, artifact id = ${latestArtifactId}`);
  try {
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
    ).catch(e => {
      log.error('Failed to extract images.', e);
      throw e;
    });
  } catch (e: any) {
    if (e.message === 'Artifact has expired') {
      log.error('Failed to download expected images. Because expected artifact has already expired.');
      return;
    }
    log.error(`Failed to download artifact ${e}`);
  }
};

const copyActualImages = (imagePath: string) => {
  log.info(`Start copyImage from ${imagePath}`);

  try {
    cpx.copySync(
      path.join(imagePath, `**/*.{png,jpg,jpeg,tiff,bmp,gif}`),
      path.join(workspace(), constants.ACTUAL_DIR_NAME),
    );
  } catch (e) {
    log.error(`Failed to copy images ${e}`);
  }
};

type UploadClient = {
  uploadArtifact: (files: string[], artifactName: string) => Promise<void>;
};

// Compare images and upload result.
const compareAndUpload = async (client: UploadClient, config: Config): Promise<CompareOutput> => {
  const result = await compare(config);
  log.debug('compare result', result);

  const files = globSync(path.join(workspace(), '**/*'));

  log.info('Start upload artifact');

  try {
    await client.uploadArtifact(files, config.artifactName);
  } catch (e) {
    log.error(e);
    throw new Error('Failed to upload artifact');
  }
  log.info('Succeeded to upload artifact');

  return result;
};

const init = async (config: Config) => {
  log.info(`start initialization.`);
  // Create workspace
  await makeDir(workspace());

  log.info(`Succeeded to cerate directory.`);

  // Copy actual images
  copyActualImages(config.imageDirectoryPath);

  log.info(`Succeeded to initialization.`);
};

type CommentClient = {
  postComment: (issueNumber: number, comment: string) => Promise<void>;
};

type SummaryClient = {
  summary: (raw: string) => Promise<void>;
};

type Client = CommentClient & DownloadClient & UploadClient & RunClient & SummaryClient;

export const run = async ({
  event,
  runId,
  sha,
  client,
  date,
  config,
}: {
  event: Event;
  runId: number;
  sha: string;
  client: Client;
  date: string;
  config: Config;
}) => {
  // Setup directory for artifact and copy images.
  await init(config);

  // If event is not pull request, upload images then finish actions.
  // This data is used as expected data for the next time.
  if (typeof event.number === 'undefined') {
    log.info(`event number is not detected.`);
    await compareAndUpload(client, config);
    return;
  }

  log.info(`start to find run and artifact.`);
  // Find current run and target run and artifact.
  const runAndArtifact = await findRunAndArtifact({
    event,
    client,
    targetHash: config.targetHash,
    artifactName: config.artifactName,
  });

  // If target artifact is not found, upload images.
  if (!runAndArtifact || !runAndArtifact.run || !runAndArtifact.artifact) {
    log.warn('Failed to find current or target runs');
    const result = await compareAndUpload(client, config);

    // If we have current run, add comment to PR.
    if (runId) {
      const comment = createCommentWithoutTarget({ event, runId, result, artifactName: config.artifactName });
      await client.postComment(event.number, comment);
    }
    return;
  }

  const { run: targetRun, artifact } = runAndArtifact;

  // Download and copy expected images to workspace.
  await downloadExpectedImages(client, artifact.id);

  const result = await compareAndUpload(client, config);

  log.info(result);

  // If changed, upload images to specified branch.
  if (result.deletedItems.length !== 0 || result.failedItems.length !== 0 || result.newItems.length !== 0) {
    await pushImages({
      githubToken: config.githubToken,
      runId,
      result,
      branch: config.branch,
      targetDir: targetDir({ runId, artifactName: config.artifactName, date }),
      env: process.env,
      // commitName: undefined,
      // commitEmail: undefined,
    });
  }

  const comment = createCommentWithTarget({
    event,
    runId,
    sha,
    targetRun,
    date,
    result,
    artifactName: config.artifactName,
    regBranch: config.branch,
  });

  await client.postComment(event.number, comment);

  log.info('post summary comment');

  await client.summary(comment);
};
