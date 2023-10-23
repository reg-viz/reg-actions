import { components } from '@octokit/openapi-types';

import { log } from './logger';
import { findTargetHash } from './git';
import { Event } from './event';
// import { ARTIFACT_NAME } from './constants';

export type Run = components['schemas']['workflow-run'];

export type FindRunAndArtifactInput = {
  event: Event;
  client: RunClient;
  artifactName: string;
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

const limitation = 200;

export const findRunAndArtifact = async ({
  event,
  client,
  targetHash: inputTargetHash,
  artifactName,
}: FindRunAndArtifactInput): Promise<{
  run: Run | null;
  artifact: Artifact | null;
} | null> => {
  let page = 0;
  while (true) {
    if (!event.pull_request) {
      return null;
    }
    try {
      log.info(`start to fetch runs page = ${page}`);
      const runs = await client.fetchRuns(page++);

      log.info(`Succeeded to find ${runs.data.workflow_runs.length} runs`);

      // If target is passed to this function, use it.
      const targetHash =
        inputTargetHash ?? (await findTargetHash(event.pull_request.base.sha, event.pull_request.head.sha));
      const targetHashShort = targetHash.slice(0, 7);

      log.info(`targetHash = ${targetHash}`);

      for (const run of runs.data.workflow_runs.filter(run => run.head_sha.startsWith(targetHashShort))) {
        const res = await client.fetchArtifacts(run.id);
        const { artifacts } = res.data;
        const found = artifacts.find(a => a.name === artifactName);
        if (found) {
          return { run, artifact: found };
        }
      }

      if (runs.data.workflow_runs.length < 50) {
        log.info('Failed to find target run', runs.data.workflow_runs.length);
        return null;
      }

      if (limitation <= page) {
        log.info(`Failed to find target run, this is because page reached limitation`, limitation, page);
        return null;
      }
    } catch (e) {
      log.error('Failed to find run', e);
      return null;
    }
  }
};
