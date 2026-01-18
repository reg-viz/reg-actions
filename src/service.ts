import * as fs from 'fs';
import * as path from 'path';
import cpy from 'cpy';
import { sync as globSync } from 'glob';
import makeDir from 'make-dir';
import Zip from 'adm-zip';

import { log } from './logger';
import { Config } from './config';
import { Event } from './event';
import { findRunAndArtifact, RunClient } from './run';
import { compare, CompareOutput } from './compare';
import { createCommentWithTarget, createCommentWithoutTarget, isRegActionComment } from './comment';
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
    const buf = Buffer.from(zip.data as any);
    log.info(`Downloaded zip size = ${buf.byteLength}`);
    const entries = new Zip(buf).getEntries();
    log.info(`entry size = ${entries.length}`);
    for (const entry of entries) {
      if (entry.isDirectory || !entry.entryName.startsWith(constants.ACTUAL_DIR_NAME)) continue;
      // https://github.com/reg-viz/reg-actions/security/code-scanning/2
      if (entry.entryName.includes('..')) continue;
      const f = path.join(workspace(), entry.entryName.replace(constants.ACTUAL_DIR_NAME, constants.EXPECTED_DIR_NAME));
      await makeDir(path.dirname(f));
      log.info('download to', f);
      await fs.promises.writeFile(f, entry.getData());
    }
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
      path.join(imagePath, `**/*.{png,jpg,jpeg,tiff,bmp,gif,webp}`),
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

  const files = globSync(path.join(workspace(), '**/*'));

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
  await fs.promises.rm(workspace(), {
    recursive: true,
    force: true,
  });

  log.info(`Succeeded to cleanup workspace.`);

  // Create workspace
  await makeDir(workspace());

  log.info(`Succeeded to create directory.`);

  // Copy actual images
  await copyActualImages(config.imageDirectoryPath);

  log.info(`Succeeded to initialization.`);
};

type CommentClient = {
  postComment: (issueNumber: number, comment: string) => Promise<void>;
  listComments: (issueNumber: number) => Promise<{ node_id: string; body?: string | undefined }[]>;
  minimizeOutdatedComment: (nodeId: string) => Promise<void>;
};

const minimizePreviousComments = async (client: CommentClient, issueNumber: number, artifactName: string) => {
  const comments = await client.listComments(issueNumber);
  for (const comment of comments) {
    if (comment.body && isRegActionComment({ artifactName, body: comment.body })) {
      await client.minimizeOutdatedComment(comment.node_id);
    }
  }
};

const hasChanges = (result: CompareOutput): boolean => {
  return result.deletedItems.length > 0 || result.failedItems.length > 0 || result.newItems.length > 0;
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

      try {
        if (config.outdatedCommentAction === 'minimize') {
          await minimizePreviousComments(client, event.number, config.artifactName);
        }
        await client.postComment(event.number, comment);
      } catch (e) {
        log.warn(`Failed to postComment, reason ${e}`);
      }
    }
    return;
  }

  const { run: targetRun, artifact } = runAndArtifact;

  log.info(`targetRun id is ${targetRun.id} workflow id = ${targetRun.workflow_id}`);

  // Download and copy expected images to workspace.
  await downloadExpectedImages(client, artifact.id);

  const result = await compareAndUpload(client, config);

  log.info('Result', result);

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
        retentionDays: config.retentionDays,
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

  const shouldComment =
    config.commentMode === 'always' || (config.commentMode === 'changes' && hasChanges(result));

  if (shouldComment) {
    try {
      if (config.outdatedCommentAction === 'minimize') {
        await minimizePreviousComments(client, event.number, config.artifactName);
      }
      await client.postComment(event.number, comment);

      log.info('post summary comment');

      await client.summary(comment);
    } catch (e) {
      log.error(e);
    }
  } else {
    log.info(`Skipping comment (comment: ${config.commentMode}, has changes: ${hasChanges(result)})`);
  }
};
