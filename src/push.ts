// This file is based on https://github.com/s0/git-publish-subdir-action
// MIT License
//
// Copyright (c) 2018 Sam Lanning
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { stream as fgStream } from 'fast-glob';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import cpx from 'cpx';

import { mkdirP } from '@actions/io';
import { add, checkout, clone, commit, configureEmail, configureName, fetchOrigin, hasBranch, push } from './git';
import { log } from './logger';
import { CompareOutput } from './compare';
import { workspace } from './path';
import * as constants from './constants';

export type PushImagesInput = {
  githubToken: string;
  runId: number;
  result: CompareOutput;
  branch: string;
  targetDir: string;
  env: EnvironmentVariables;
  // commitName?: string;
  // commitEmail?: string;
};

export interface EnvironmentVariables {
  GITHUB_REPOSITORY?: string;
  GITHUB_EVENT_PATH?: string;
  /** The name of the person / app that that initiated the workflow */
  GITHUB_ACTOR?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvironmentVariables {}
  }
}

export type Config = {
  branch: string;
  repo: string;
};

/**
 * The GitHub event that triggered this action
 */
export type Event = {
  pusher?: {
    email?: string;
    name?: string;
  };
};

const genConfig = (input: PushImagesInput): Config => {
  const { branch, env } = input;
  // Determine the type of URL
  if (!input.githubToken) throw new Error('GITHUB_TOKEN must be specified when REPO == self');
  if (!env.GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY must be specified when REPO == self');

  const url = `https://x-access-token:${input.githubToken}@github.com/${env.GITHUB_REPOSITORY}.git`;
  const config: Config = {
    repo: url,
    branch,
  };
  return config;
};

const copyImages = (result: CompareOutput, temp: string, dest: string): Promise<void[]> => {
  log.info(`Copying all files`);

  const promises: Promise<void>[] = [];
  const cp = (src: string, dst: string) =>
    new Promise<void>(resolve => {
      cpx.copy(src, dst, () => resolve());
    });

  if (result.deletedItems.length > 0) {
    const deletedGlobs =
      result.deletedItems.length === 1
        ? `${path.join(workspace(), constants.EXPECTED_DIR_NAME)}/${result.deletedItems[0]}`
        : `${path.join(workspace(), constants.EXPECTED_DIR_NAME)}/(${result.deletedItems.join('|')})`;
    promises.push(cp(deletedGlobs, `${temp}/${dest}/expected/`));
  }

  if (result.newItems.length > 0) {
    const newGlobs =
      result.newItems.length === 1
        ? `${path.join(workspace(), constants.ACTUAL_DIR_NAME)}/${result.newItems[0]}`
        : `${path.join(workspace(), constants.ACTUAL_DIR_NAME)}/(${result.newItems.join('|')})`;

    promises.push(cp(newGlobs, `${temp}/${dest}/actual/`));
  }

  if (result.failedItems.length > 0) {
    const failedGlobs =
      result.failedItems.length === 1
        ? `${path.join(workspace(), constants.DIFF_DIR_NAME)}/${result.failedItems[0]}`
        : `${path.join(workspace(), constants.DIFF_DIR_NAME)}/(${result.failedItems.join('|')})`;
    promises.push(cp(failedGlobs, `${temp}/${dest}/diff/`));

    const expectedGlobs =
      result.failedItems.length === 1
        ? `${path.join(workspace(), constants.EXPECTED_DIR_NAME)}/${result.failedItems[0]}`
        : `${path.join(workspace(), constants.EXPECTED_DIR_NAME)}/(${result.failedItems.join('|')})`;
    promises.push(cp(expectedGlobs, `${temp}/${dest}/expected/`));

    const actualGlobs =
      result.failedItems.length === 1
        ? `${path.join(workspace(), constants.ACTUAL_DIR_NAME)}/${result.failedItems[0]}`
        : `${path.join(workspace(), constants.ACTUAL_DIR_NAME)}/(${result.failedItems.join('|')})`;
    promises.push(cp(actualGlobs, `${temp}/${dest}/actual/`));
  }
  return Promise.all(promises);
};

export const pushImages = async (input: PushImagesInput) => {
  const { env } = input;
  const config = genConfig(input);

  const TMP_PATH = await fs.mkdtemp(path.join(tmpdir(), 'reg-actions-'));
  const REPO_TEMP = path.join(TMP_PATH, 'repo');

  if (!env.GITHUB_EVENT_PATH) throw new Error('Expected GITHUB_EVENT_PATH');

  const event: Event = JSON.parse((await fs.readFile(env.GITHUB_EVENT_PATH)).toString());

  const name = /* input.commitName ?? */ event.pusher?.name ?? env.GITHUB_ACTOR ?? 'Git Publish Subdirectory';
  const email =
    // input.commitEmail ??
    event.pusher?.email ?? (env.GITHUB_ACTOR ? `${env.GITHUB_ACTOR}@users.noreply.github.com` : 'nobody@nowhere');

  // Set Git Config
  await configureName(name);
  await configureEmail(email);

  // Environment to pass to children
  const execEnv = env as { [key: string]: string };

  // Clone the target repo
  await clone({ repo: config.repo, dist: REPO_TEMP }, { env: execEnv });

  const execOptions = { env: execEnv, cwd: REPO_TEMP };

  // Fetch branch if it exists
  await fetchOrigin({ branch: config.branch }, execOptions).catch(err => {
    const s = err.toString();
    if (s.indexOf("Couldn't find remote ref") === -1) {
      log.warn("Failed to fetch target branch, probably doesn't exist");
      log.error(err);
    }
  });

  // Check if branch already exists
  log.info(`Checking if branch ${config.branch} exists already`);

  if (!(await hasBranch(config.branch, execOptions))) {
    // Branch does not exist yet, let's check it out as an orphan
    log.info(`${config.branch} does not exist, creating as orphan`);
    await checkout(config.branch, true, execOptions);
  } else {
    await checkout(config.branch, false, execOptions);
  }

  // Update contents of branch
  log.info(`Updating branch ${config.branch}`);

  /**
   * The list of globs we'll use for clearing
   */
  log.info(`Removing all files from target dir ${input.targetDir} on target branch`);

  const globs = ['**/*', '!.git'];
  if (!hasBranch) {
    const filesToDelete = fgStream(globs, { absolute: true, dot: true, followSymbolicLinks: false, cwd: REPO_TEMP });
    // Delete all files from the filestream
    for await (const entry of filesToDelete) {
      await fs.unlink(entry);
    }
  }

  const destDir = input.targetDir;

  // Make sure the destination sourceDir exists
  await mkdirP(path.resolve(REPO_TEMP, destDir));

  await copyImages(input.result, REPO_TEMP, destDir);

  await add(execOptions);

  const message = `Update ${input.branch} to output generated at runId:${input.runId}`;
  await commit(message, execOptions);

  log.info(`Pushing`);

  const res = await push(config.branch, execOptions);

  log.info(res.stdout);
  log.info(`Deployment Successful`);
};
