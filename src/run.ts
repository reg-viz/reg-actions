import { components } from '@octokit/openapi-types';

import { log } from './logger';
import { findTargetHash } from './git';
import { Event } from './event';
import { ARTIFACT_NAME } from './constants';

export type Run = components['schemas']['workflow-run'];

export type FindRunAndArtifactInput = {
  event: Event;
  client: RunClient;
  targetHash?: string | null;
};

export type Artifact = {
  id: number;
  name: string;
};

export type RunClient = {
  fetchRuns: (page: number) => Promise<{ data: { workflow_runs: Run[] } }>;
  fetchArtifacts: (runId: number) => Promise<{ data: { artifacts: Artifact[] } }>;
};

export const findRunAndArtifact = async ({
  event,
  client,
  targetHash: inputTargetHash,
}: FindRunAndArtifactInput): Promise<{
  targetRun: Run | null;
  targetArtifact: Artifact | null;
} | null> => {
  let page = 0;
  while (true) {
    const runs = await client.fetchRuns(page++);
    if (!event.pull_request) {
      return null;
    }

    // If target is passed to this function, use it.
    const targetHash =
      inputTargetHash ?? (await findTargetHash(event.pull_request.base.sha, event.pull_request.head.sha));
    const targetHashShort = targetHash.slice(0, 7);

    log.info(`targetHash = ${targetHash}`);

    for (const run of runs.data.workflow_runs.filter(run => run.head_sha.startsWith(targetHashShort))) {
      const res = await client.fetchArtifacts(run.id);
      const { artifacts } = res.data;
      const found = artifacts.find(a => a.name === ARTIFACT_NAME);
      if (found) {
        return { targetRun: run, targetArtifact: found };
      }
    }
    if (runs.data.workflow_runs.length < 100) {
      log.info('Failed to find target run');
      return null;
    }
  }
};
