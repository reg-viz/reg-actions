import * as core from '@actions/core';
import * as github from '@actions/github';
import * as artifact from '@actions/artifact';
import { components } from '@octokit/openapi-types';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import cpx from 'cpx';
import { sync as globSync } from 'glob';
import makeDir from 'make-dir';
import { promisify } from 'util';
import { log } from './logger';

const compare = require('reg-cli');
const NodeZip = require('node-zip');

const artifactClient = artifact.create();

const token = core.getInput('secret');

const octokit = github.getOctokit(token);

const writeFileAsync = promisify(fs.writeFile);

const { repo } = github.context;

type Octokit = ReturnType<typeof github.getOctokit>;

type Event = {
  before: string | null;
  after: string | null;
  pull_request: components['schemas']['pull-request'] | null;
  app: components['schemas']['nullable-integration'];
  repository: components['schemas']['minimal-repository'];
  number?: number;
};

const readEvent = (): Event | undefined => {
  try {
    if (process.env.GITHUB_EVENT_PATH) {
      return JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    }
  } catch (e) {}
};

const event = readEvent();

log.info(`event = `, event);

if (!event) {
  throw new Error('Failed to get github event.json..');
}

const actual = core.getInput('image-directory-path');
log.info(`actual directory is ${actual}`);

type Run = components['schemas']['workflow-run'];

const findCurrentAndTargetRuns = async (): Promise<{ current: Run; target: Run } | null> => {
  let currentRun: Run | null = null;

  const currentHash = (event.after ?? event?.pull_request?.head?.sha)?.slice(0, 7);
  log.info(`event.after = ${event.after} head sha = ${event.pull_request?.head?.sha}`);
  if (!currentHash) return null;

  let page = 0;
  while (true) {
    const runs = await octokit.rest.actions.listWorkflowRunsForRepo({
      ...repo,
      per_page: 100,
      page: page++,
    });

    if (!currentRun) {
      const run = runs.data.workflow_runs.find(run => run.head_sha.startsWith(currentHash));
      if (run) {
        currentRun = run;
        log.info(`currentRun = `, currentRun);
      }
    }
    if (!event.pull_request) return null;
    const targetHash = execSync(
      `git merge-base -a origin/${event.pull_request.base.ref} origin/${event.pull_request.head.ref}`,
      { encoding: 'utf8' },
    ).slice(0, 7);

    log.info(`targetHash = ${targetHash}`);

    const targetRun = runs.data.workflow_runs.find(run => run.head_sha.startsWith(targetHash));

    log.debug('runs = ', runs.data.workflow_runs.length);
    log.info(`targetRun = `, targetRun);

    if (targetRun && currentRun) {
      return { current: currentRun, target: targetRun };
    }

    if (runs.data.workflow_runs.length < 100) {
      log.info('Failed to find target run');
      return null;
    }
  }
};

const downloadExpectedImages = async (
  octokit: Octokit,
  repo: { owner: string; repo: string },
  latestArtifactId: number,
) => {
  const zip = await octokit.rest.actions.downloadArtifact({
    ...repo,
    artifact_id: latestArtifactId,
    archive_format: 'zip',
  });

  const files = new NodeZip(zip.data, { base64: false, checkCRC32: true });

  await Promise.all(
    Object.keys(files.files)
      .map(key => files.files[key])
      .filter(file => !file.dir)
      .map(async file => {
        const f = path.join('__reg__', 'expected', path.basename(file.name));
        await makeDir(path.dirname(f));
        await writeFileAsync(f, str2ab(file._data));
      }),
  );
};

const copyImages = () => {
  cpx.copySync(path.join(actual, `**/*.{png,jpg,jpeg,tiff,bmp,gif}`), './__reg__/actual');
};

const compareAndUpload = async () =>
  new Promise<void>(resolve => {
    compare({
      actualDir: './__reg__/actual',
      expectedDir: './__reg__/expected',
      diffDir: './__reg__/diff',
      json: './__reg__/0',
      update: false,
      ignoreChange: true,
      urlPrefix: '',
    }).on('complete', async result => {
      log.debug('compare result', result);

      const files = globSync('./__reg__/**/*');

      log.info('Start upload artifact');
      log.debug(files);

      try {
        await artifactClient.uploadArtifact('reg', files, './__reg__');
      } catch (e) {
        log.error(e);
        throw new Error('Failed to upload artifact');
      }

      log.info('Succeeded to upload artifact');
      resolve(result);
    });
  });

const run = async () => {
  await makeDir('./__reg__');

  // Copy actual images
  copyImages();

  if (typeof event.number === 'undefined') {
    log.info(`event number is not detected.`);
    await compareAndUpload();
    return;
  }

  const runs = await findCurrentAndTargetRuns();

  if (!runs) {
    log.error('Failed to find current or target runs');
    await compareAndUpload();
    return;
  }

  log.info(`currentRun = `, runs.current);

  const res = await octokit.rest.actions.listWorkflowRunArtifacts({
    ...repo,
    run_id: runs.target.id,
    per_page: 100,
  });

  log.debug('res = ', res);

  const { artifacts } = res.data;
  const latest = artifacts[artifacts.length - 1];

  log.debug('latest artifact = ', latest);

  if (latest) {
    await downloadExpectedImages(octokit, repo, latest.id);
  }
  const result: any = await compareAndUpload();

  if (event.number == null) return;

  const [owner, reponame] = event.repository.full_name.split('/');
  const url = `https://bokuweb.github.io/reg-actions-report/?owner=${owner}&repository=${reponame}&run_id=${runs.current.id}`;
  log.info(`This report URL is ${url}`);
  
  let body = '';
  if (result.failedItems.length === 0 && result.newItems === 0 && result.deletedItems === 0) {
    body = `✨✨ That's perfect, there is no visual difference! ✨✨
      Check out the report [here](${url}).`;
  } else {
    body = `Check out the report [here](${url}).
          
| item | number |  |
|:-----------|:------------:|:------------:|
| pass       | ${result.passedItems.length}        |   |
| change       | ${result.failedItems.length}        |   |
| new   | ${result.newItems.length}     |     |
| delete  | ${result.deletedItems.length}     |     |
      `;
  }

  await octokit.rest.issues.createComment({ ...repo, issue_number: event.number, body });
};

run();

function str2ab(str: string) {
  const array = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) {
    array[i] = str.charCodeAt(i);
  }
  return array;
}
