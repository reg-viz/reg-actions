import * as github from '@actions/github';
import * as artifact from '@actions/artifact';
import { components } from '@octokit/openapi-types';
import * as fs from 'fs';
import * as path from 'path';
import cpx from 'cpx';
import { sync as globSync } from 'glob';
import makeDir from 'make-dir';
import Zip from 'adm-zip';

import { log } from './logger';
import { findTargetHash } from './git';
import { createReportURL } from './report';
import { getConfig } from './config';
import { getEvent } from './event';
import * as constants from './constants';

const compare = require('reg-cli');

const config = getConfig();

const artifactClient = artifact.create();

const octokit = github.getOctokit(config.githubToken);

const { repo } = github.context;

type Octokit = ReturnType<typeof github.getOctokit>;

const event = getEvent();

const actual = config.imageDirectoryPath;
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

    const targetHash = await findTargetHash(event.pull_request.base.sha, event.pull_request.head.sha);
    const targetHashShort = targetHash.slice(0, 7);

    log.info(`targetHash = ${targetHash}`);

    for (const run of runs.data.workflow_runs.filter(run => run.head_sha.startsWith(targetHashShort))) {
      const input = { ...repo, run_id: run.id, per_page: 100 };
      const res = await octokit.rest.actions.listWorkflowRunArtifacts(input);
      log.debug('res = ', res);
      const { artifacts } = res.data;
      const found = artifacts.find(a => a.name === 'reg');
      console.log(':smile:==============', found, run);
      if (currentRun && found) {
        return { current: currentRun, target: run };
      }
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

const compareAndUpload = async () =>
  new Promise<void>(resolve => {
    compare({
      actualDir: `./__reg__/${constants.ACTUAL_DIR_NAME}`,
      expectedDir: `./__reg__/${constants.EXPECTED_DIR_NAME}`,
      diffDir: `./__reg__/${constants.DIFF_DIR_NAME}`,
      json: './__reg__/0',
      update: false,
      ignoreChange: true,
      urlPrefix: '',
      thresholdPixel: config.thresholdPixel,
      thresholdRate: config.thresholdRate,
      matchingThreshold: config.matchingThreshold,
      enableAntialias: config.enableAntialias,
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

  log.debug(`currentRun = `, runs.current);

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
  const url = createReportURL(owner, reponame, runs.current.id);
  log.info(`This report URL is ${url}`);

  const currentHash = runs.current.head_sha;
  const targetHash = runs.target.head_sha;
  const currentHashShort = currentHash.slice(0, 7);
  const targetHashShort = targetHash.slice(0, 7);

  const successOrFailMessage =
    result.failedItems.length === 0 && result.newItems.length === 0 && result.deletedItems.length === 0
      ? `![success](https://img.shields.io/badge/%E2%9C%94reg-passed-green)

✨✨ That's perfect, there is no visual difference! ✨✨
Check out the report [here](${url}).
  `
      : `![change detected](https://img.shields.io/badge/%E2%9C%94reg-change%20detected-orange)

Check out the report [here](${url}).
  `;

  const body = `This report was generated by comparing [${currentHashShort}](https://github.com/${owner}/${reponame}/commit/${currentHash}) and [${targetHashShort}](https://github.com/${owner}/${reponame}/commit/${targetHash}).
If you would like to check difference, please check [here](https://github.com/${owner}/${reponame}/compare/${currentHashShort}..${targetHashShort}).

${successOrFailMessage}

| item | number |  |
|:-----------|:------------:|:------------:|
| pass       | ${result.passedItems.length}        |   |
| change       | ${result.failedItems.length}        |   |
| new   | ${result.newItems.length}     |     |
| delete  | ${result.deletedItems.length}     |     |
`;
  await octokit.rest.issues.createComment({ ...repo, issue_number: event.number, body });
};

run();
