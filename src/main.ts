import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import cpx from 'cpx';
import makeDir from 'make-dir';
import { promisify } from 'util';

const compare = require('reg-cli');
const NodeZip = require('node-zip');

const token = core.getInput('secret');

const octokit = github.getOctokit(token);
const writeFileAsync = promisify(fs.writeFile);

const { repo } = github.context;

let event;
try {
  if (process.env.GITHUB_EVENT_PATH) {
    event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  }
} catch (e) {}

if (!event) {
  throw new Error('Failed to get github event.json..');
}

const actual = core.getInput('actual-directory-path');

// TODO: fetch all run
const run = async () => {
  const runs = await octokit.rest.actions.listWorkflowRunsForRepo({
    ...repo,
    per_page: 100,
  });

  const currentHash = (
    event.after ||
    (event.pull_request && event.pull_request.head && event.pull_request.head.sha)
  ).slice(0, 7);

  const currentRun = runs.data.workflow_runs.find(run => run.head_sha.startsWith(currentHash));

  if (!currentRun) return;

  cpx.copySync(path.join(actual, `**/*.{png,jpg,jpeg,tiff,bmp,gif}`), './__reg__/actual');

  // Not PR
  if (typeof event.number === 'undefined') {
    //    await publish();
    return;
  }

  const targetHash = execSync(
    `git merge-base -a origin/${event.pull_request.base.ref} origin/${event.pull_request.head.ref}`,
    { encoding: 'utf8' },
  ).slice(0, 7);

  const targetRun = runs.data.workflow_runs.find(run => run.head_sha.startsWith(targetHash));

  if (!targetRun) {
    console.error('Failed to find target run');
    return;
  }

  // TODO: fetch all artifacts
  const res = await octokit.rest.actions.listWorkflowRunArtifacts({
    ...repo,
    run_id: targetRun.id,
    per_page: 100,
  });

  // Octokit's type definition is wrong now.
  const { artifacts } = res.data as any;
  const latest = artifacts[artifacts.length - 1];

  const zip = await octokit.rest.actions.downloadArtifact({
    ...repo,
    artifact_id: latest.id,
    archive_format: 'zip',
  });

  const files = new NodeZip(zip.data, {
    base64: false,
    checkCRC32: true,
  });

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

  const emitter = compare({
    actualDir: './__reg__/actual',
    expectedDir: './__reg__/expected',
    diffDir: './__reg__/diff',
    json: './__reg__/0',
    update: false,
    ignoreChange: true,
    urlPrefix: '',
  });

  emitter.on('compare', async (compareItem: { type: string; path: string }) => {});

  emitter.on('complete', async result => {
    const [owner, reponame] = event.repository.full_name.split('/');
    const url = `https://bokuweb.github.io/reg-action-report/?owner=${owner}&repository=${reponame}&run_id=${currentRun.id}`;

    await octokit.rest.issues.createComment({
      ...repo,
      issue_number: event.number,
      body: url,
    });
  });
};

run();

function str2ab(str: string) {
  const array = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) {
    array[i] = str.charCodeAt(i);
  }
  return array;
}
