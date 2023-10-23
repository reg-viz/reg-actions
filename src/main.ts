import * as core from '@actions/core';
import * as github from '@actions/github';

import { getConfig } from './config';
import { getEvent } from './event';
import { run } from './service';
import { createClient } from './client';
import { log } from './logger';

const main = async () => {
  const config = getConfig();

  const { repo, runId, sha } = github.context;

  const date = new Date().toISOString().split('T')[0];

  log.info(`runid = ${runId}, sha = ${sha}`);

  const event = getEvent();

  log.info(`succeeded to get event, number = ${event.number}`);

  const octokit = github.getOctokit(config.githubToken);

  const client = createClient(repo, octokit);

  log.info(`start`);

  await run({ event, runId, sha, client, date, config });
};

main().catch(e => core.setFailed(e.message));
