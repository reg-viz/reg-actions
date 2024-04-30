import * as github from '@actions/github';
import { DefaultArtifactClient } from '@actions/artifact';
import { backOff } from 'exponential-backoff';
import { summary } from '@actions/core';

import { Repository } from './repository';
import { workspace } from './path';
import { log } from './logger';
import { join } from 'path';
import { DOWNLOAD_PATH } from './constants';

export type Octokit = ReturnType<typeof github.getOctokit>;

export const createClient = (repository: Repository, octokit: Octokit) => {
  const artifactClient = new DefaultArtifactClient();

  return {
    fetchRuns: async (page: number) => {
      return backOff(
        () =>
          octokit.rest.actions.listWorkflowRunsForRepo({
            ...repository,
            per_page: 50,
            page,
          }),
        { numOfAttempts: 5 },
      );
    },
    fetchArtifacts: async (runId: number) => {
      const input = { ...repository, run_id: runId, per_page: 50 };
      return backOff(() => octokit.rest.actions.listWorkflowRunArtifacts(input), { numOfAttempts: 5 });
    },
    uploadArtifact: async (files: string[], artifactName: string) => {
      const res = await backOff(() => artifactClient.uploadArtifact(artifactName, files, workspace()), {
        numOfAttempts: 5,
      });
      return res;
    },
    downloadArtifact: async (token: string, artifactId: number, runId: number) => {
      const { downloadPath } = await backOff(
        () =>
          artifactClient.downloadArtifact(artifactId, {
            path: DOWNLOAD_PATH,
            findBy: {
              token,
              workflowRunId: runId,
              repositoryName: repository.repo,
              repositoryOwner: repository.owner,
            },
          }),
        {
          numOfAttempts: 5,
        },
      );
      log.info('downloadPath:', downloadPath);
      return;
    },
    postComment: async (issueNumber: number, comment: string) => {
      const _ = await backOff(
        () => octokit.rest.issues.createComment({ ...repository, issue_number: issueNumber, body: comment }),
        { numOfAttempts: 5 },
      );
      return;
    },
    summary: async (raw: string): Promise<void> => {
      summary.addRaw(raw).write();
    },
  };
};
