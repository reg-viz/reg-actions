import * as core from '@actions/core';
import * as github from '@actions/github';

import { getConfig } from './config';
import { getEvent } from './event';
import { run } from './usecase';

const main = async () => {
  const config = getConfig();

  const { repo } = github.context;

  const event = getEvent();

  await run(event, repo, config);
};

main().catch(e => core.setFailed(e.message));
