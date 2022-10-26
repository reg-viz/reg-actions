import * as github from '@actions/github';
import * as artifact from '@actions/artifact';
import { backOff } from 'exponential-backoff';

import { Repository } from './repository';
import * as constants from './constants';
import { workspace } from './path';

export type Octokit = ReturnType<typeof github.getOctokit>;

export const createClient = (repository: Repository, octokit: Octokit) => {
  const artifactClient = artifact.create();

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
    uploadArtifact: async (files: string[]) => {
      const _ = await backOff(() => artifactClient.uploadArtifact(constants.ARTIFACT_NAME, files, workspace()), {
        numOfAttempts: 5,
      });
      return;
    },
    downloadArtifact: async (artifactId: number) => {
      return backOff(
        () =>
          octokit.rest.actions.downloadArtifact({
            ...repository,
            artifact_id: artifactId,
            archive_format: 'zip',
          }),
        { numOfAttempts: 5 },
      );
    },
    postComment: async (issueNumber: number, comment: string) => {
      const _ = await backOff(
        () => octokit.rest.issues.createComment({ ...repository, issue_number: issueNumber, body: comment }),
        { numOfAttempts: 5 },
      );
      return;
    },
  };
};
