import * as core from '@actions/core';
import * as github from '@actions/github';

import { getConfig } from './config';
import { getEvent } from './event';
import { run } from './usecase';
import { createClient } from './client';

const main = async () => {
  const config = getConfig();

  const { repo } = github.context;

  const event = getEvent();

 const octokit = github.getOctokit(config.githubToken);

  const client = createClient(repo, octokit);

  await run(event, client, config);
};

main().catch(e => core.setFailed(e.message));
