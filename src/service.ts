import * as fs from 'fs/promises';
import * as path from 'path';
import cpy from 'cpy';
import { glob } from 'glob';
import makeDir from 'make-dir';

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
  downloadArtifact: (token: string, artifactId: number, runId: number, artifactName: string) => Promise<void>;
};

// Download expected images from target artifact.
const downloadExpectedImages = async (
  client: DownloadClient,
  latestArtifactId: number,
  runId: number,
  config: Config,
) => {
  log.info(`Start to download expected images, artifact id = ${latestArtifactId}`);
  try {
    await client.downloadArtifact(config.githubToken, latestArtifactId, runId, config.artifactName);

    await cpy(
      `${constants.DOWNLOAD_PATH}/**/${constants.ACTUAL_DIR_NAME}/**/*.{png,jpg,jpeg,tiff,bmp,gif}`,
      path.join(workspace(), constants.EXPECTED_DIR_NAME),
    );

    const files = await glob(`${constants.DOWNLOAD_PATH}/**/*`);
    await Promise.all(
      files
        .filter(f => {
          log.info('fileName:', f);
          return f.startsWith(constants.ACTUAL_DIR_NAME);
        })
        .map(async file => {
          const f = path.join(workspace(), file.replace(constants.ACTUAL_DIR_NAME, constants.EXPECTED_DIR_NAME));
          await makeDir(path.dirname(f));
          log.info('download to', f);
          await fs.copyFile(file, f);
        }),
    );
  } catch (e: any) {
    if (e.message === 'Artifact has expired') {
      log.error('Failed to download expected images. Because expected artifact has already expired.');
      return;
    }
    log.error(`Failed to download artifact ${e}`);
  }
};

const copyActualImages = async (imagePath: string) => {
  log.info(`Start copyImage from ${imagePath}`);

  try {
    await cpy(
      path.join(imagePath, `**/*.{png,jpg,jpeg,tiff,bmp,gif}`),
      path.join(workspace(), constants.ACTUAL_DIR_NAME),
    );
  } catch (e) {
    log.error(`Failed to copy images ${e}`);
  }
};

type UploadClient = {
  uploadArtifact: (files: string[], artifactName: string) => Promise<{ id?: number }>;
};

// Compare images and upload result.
const compareAndUpload = async (client: UploadClient, config: Config): Promise<CompareOutput & { id?: number }> => {
  const result = await compare(config);
  log.info('compare result', result);

  const files = await glob.glob(path.join(workspace(), '**/*'));

  log.info('Start upload artifact');

  try {
    const res = await client.uploadArtifact(files, config.artifactName);
    log.info('Succeeded to upload artifact');

    return { id: res.id, ...result };
  } catch (e) {
    log.error(e);
    throw new Error('Failed to upload artifact');
  }
};

const init = async (config: Config) => {
  log.info(`start initialization with config.`, config);

  // Cleanup workspace
  await fs.rm(workspace(), {
    recursive: true,
    force: true,
  });

  log.info(`Succeeded to cleanup workspace.`);

  // Create workspace
  await makeDir(workspace());

  log.info(`Succeeded to cerate directory.`);

  // Copy actual images
  await copyActualImages(config.imageDirectoryPath);

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
      const comment = createCommentWithoutTarget({
        event,
        runId,
        result,
        artifactName: config.artifactName,
        customReportPage: config.customReportPage,
      });
      await client.postComment(event.number, comment);
    }
    return;
  }

  const { run: targetRun, artifact } = runAndArtifact;

  // Download and copy expected images to workspace.
  await downloadExpectedImages(client, artifact.id, targetRun.id, config);

  const result = await compareAndUpload(client, config);

  log.info(result);

  // If changed, upload images to specified branch.
  if (!config.disableBranch) {
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
  }

  const comment = createCommentWithTarget({
    event,
    runId,
    sha,
    targetRun,
    date,
    result,
    artifactName: config.artifactName,
    artifactId: result.id,
    regBranch: config.branch,
    customReportPage: config.customReportPage,
    disableBranch: config.disableBranch,
    commentReportFormat: config.commentReportFormat,
  });

  try {
    await client.postComment(event.number, comment);

    log.info('post summary comment');

    await client.summary(comment);
  } catch (e) {
    log.error(e);
  }
};
