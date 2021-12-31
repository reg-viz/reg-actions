import { components } from '@octokit/openapi-types';

import { log } from './logger';
import { findTargetHash } from './git';
import { Event } from './event';
import { ARTIFACT_NAME } from './constants';

export type Run = components['schemas']['workflow-run'];

export type FindRunAndArtifactInput = {
  event: Event;
  client: RunClient;
};

export type Artifact = {
  id: number;
  name: string;
};

export interface RunClient {
  fetchRuns: (page: number) => Promise<{ data: { workflow_runs: Run[] } }>;
  fetchArtifacts: (runId: number) => Promise<{ data: { artifacts: Artifact[] } }>;
}

export const findRunAndArtifact = async ({
  event,
  client,
}: FindRunAndArtifactInput): Promise<{
  currentRun: Run;
  targetRun: Run | null;
  targetArtifact: Artifact | null;
} | null> => {
  let currentRun: Run | null = null;

  const currentHash = (event.after ?? event?.pull_request?.head?.sha)?.slice(0, 7);

  if (!currentHash) return null;

  log.info(`current hash is ${currentHash}.`);

  let page = 0;
  while (true) {
    const runs = await client.fetchRuns(page++);
    if (!currentRun) {
      const run = runs.data.workflow_runs.find(run => run.head_sha.startsWith(currentHash));
      if (run) {
        currentRun = run;
        log.debug(`currentRun = `, currentRun);
      }
    }
    if (!event.pull_request) {
      if (currentRun) {
        return { currentRun, targetRun: null, targetArtifact: null };
      }
      return null;
    }

    const targetHash = await findTargetHash(event.pull_request.base.sha, event.pull_request.head.sha);
    const targetHashShort = targetHash.slice(0, 7);

    log.info(`targetHash = ${targetHash}`);

    for (const run of runs.data.workflow_runs.filter(run => run.head_sha.startsWith(targetHashShort))) {
      const res = await client.fetchArtifacts(run.id);
      const { artifacts } = res.data;
      const found = artifacts.find(a => a.name === ARTIFACT_NAME);
      if (currentRun && found) {
        return { currentRun, targetRun: run, targetArtifact: found };
      }
    }
    if (runs.data.workflow_runs.length < 100) {
      log.info('Failed to find target run');
      if (currentRun) {
        return { currentRun, targetRun: null, targetArtifact: null };
      }
      return null;
    }
  }
};
