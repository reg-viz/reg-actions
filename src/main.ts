import * as github from '@actions/github';
import * as artifact from '@actions/artifact';
import * as fs from 'fs';
import * as path from 'path';
import cpx from 'cpx';
import { sync as globSync } from 'glob';
import makeDir from 'make-dir';
import Zip from 'adm-zip';

import { log } from './logger';
import { Config, getConfig } from './config';
import { getEvent } from './event';
import { findRunAndArtifact } from './run';
import { createClient } from './client';
import { compare } from './compare';
import { createCommentWithTarget } from './comment';
import * as constants from './constants';
import { Repository } from './repository';

const config = getConfig();

const artifactClient = artifact.create();

const octokit = github.getOctokit(config.githubToken);

const { repo } = github.context;

type Octokit = ReturnType<typeof github.getOctokit>;

const event = getEvent();

const actual = config.imageDirectoryPath;
log.info(`actual directory is ${actual}`);

const downloadExpectedImages = async (octokit: Octokit, repo: Repository, latestArtifactId: number) => {
  const zip = await octokit.rest.actions.downloadArtifact({
    ...repo,
    artifact_id: latestArtifactId,
    archive_format: 'zip',
  });

  await Promise.all(
    new Zip(Buffer.from(zip.data as any))
      .getEntries()
      .filter(f => {
        return !f.isDirectory && f.entryName.startsWith(constants.ACTUAL_DIR_NAME);
      })
      .map(async file => {
        const f = path.join('__reg__', file.entryName.replace(constants.ACTUAL_DIR_NAME, constants.EXPECTED_DIR_NAME));
        await makeDir(path.dirname(f));
        await fs.promises.writeFile(f, file.getData());
      }),
  );
};

const copyImages = () => {
  cpx.copySync(path.join(actual, `**/*.{png,jpg,jpeg,tiff,bmp,gif}`), `./__reg__/${constants.ACTUAL_DIR_NAME}`);
};

const compareAndUpload = async (config: Config) => {
  const result = await compare(config);
  log.debug('compare result', result);

  const files = globSync('./__reg__/**/*');

  log.info('Start upload artifact');

  try {
    await artifactClient.uploadArtifact('reg', files, './__reg__');
  } catch (e) {
    log.error(e);
    throw new Error('Failed to upload artifact');
  }
  log.info('Succeeded to upload artifact');

  return result;
};

const init = async () => {
  // Create workspace
  await makeDir('./__reg__');

  // Copy actual images
  copyImages();
};

const run = async () => {
  await init();

  if (typeof event.number === 'undefined') {
    log.info(`event number is not detected.`);
    await compareAndUpload(config);
    return;
  }

  const client = createClient(repo, octokit);
  const runAndArtifact = await findRunAndArtifact({ event, client });

  if (!runAndArtifact) {
    log.warn('Failed to find current or target runs');
    await compareAndUpload(config);
    return;
  }

  const { currentRun, targetRun, targetArtifact } = runAndArtifact;

  if (targetArtifact) {
    await downloadExpectedImages(octokit, repo, targetArtifact.id);
  }

  const result = await compareAndUpload(config);

  const comment = createCommentWithTarget({ event, currentRun, targetRun, result });

  await octokit.rest.issues.createComment({ ...repo, issue_number: event.number, body: comment });
};

run();
