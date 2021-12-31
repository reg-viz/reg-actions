import * as github from '@actions/github';
import * as artifact from '@actions/artifact';
import * as fs from 'fs';
import * as path from 'path';
import cpx from 'cpx';
import { sync as globSync } from 'glob';
import makeDir from 'make-dir';
import Zip from 'adm-zip';

import { log } from './logger';
import { Config } from './config';
import { Event } from './event';
import { findRunAndArtifact } from './run';
import { createClient, Octokit } from './client';
import { compare, CompareOutput } from './compare';
import { createCommentWithTarget, createCommentWithoutTarget } from './comment';
import * as constants from './constants';
import { Repository } from './repository';
import { workspace } from './path';

type Client = {
  downloadArtifact: (id: number) => Promise<{ data: any }>;
};

// Download expected images from target artifact.
const downloadExpectedImages = async (client: Client, latestArtifactId: number) => {
  const zip = await client.downloadArtifact(latestArtifactId);
  await Promise.all(
    new Zip(Buffer.from(zip.data))
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

// Compare images and upload result.
const compareAndUpload = async (config: Config): Promise<CompareOutput> => {
  const result = await compare(config);
  log.debug('compare result', result);

  const files = globSync(path.join(workspace(), '**/*'));

  log.info('Start upload artifact');

  try {
    const artifactClient = artifact.create();
    await artifactClient.uploadArtifact(constants.ARTIFACT_NAME, files, workspace());
  } catch (e) {
    log.error(e);
    throw new Error('Failed to upload artifact');
  }
  log.info('Succeeded to upload artifact');

  return result;
};

const init = async (config: Config) => {
  // Create workspace
  await makeDir(workspace());

  // Copy actual images
  copyImages(config.imageDirectoryPath);
};

export const run = async (event: Event, repo: Repository, config: Config) => {
  const octokit = github.getOctokit(config.githubToken);
  const client = createClient(repo, octokit);

  // Setup directory for artifact and copy images.
  await init(config);

  // If event is not pull request, upload images then finish actions.
  // This data is used as expected data for the next time.
  if (typeof event.number === 'undefined') {
    log.info(`event number is not detected.`);
    await compareAndUpload(config);
    return;
  }

  // Find current run and target run and artifact.
  const runAndArtifact = await findRunAndArtifact({ event, client });

  // If target artifact is not found, upload images.
  if (!runAndArtifact || !runAndArtifact.targetRun || !runAndArtifact.targetArtifact) {
    log.warn('Failed to find current or target runs');
    const result = await compareAndUpload(config);

    // If we have current run, add comment to PR.
    if (runAndArtifact?.currentRun) {
      const comment = createCommentWithoutTarget({ event, currentRun: runAndArtifact?.currentRun, result });
      await octokit.rest.issues.createComment({ ...repo, issue_number: event.number, body: comment });
    }
    return;
  }

  const { currentRun, targetRun, targetArtifact } = runAndArtifact;

  // Download and copy expected images to workspace.
  await downloadExpectedImages(client, targetArtifact.id);

  const result = await compareAndUpload(config);

  const comment = createCommentWithTarget({ event, currentRun, targetRun, result });

  await client.postComment(event.number, comment);
};
