import * as github from '@actions/github';

import { Repository } from './repository';

export type Octokit = ReturnType<typeof github.getOctokit>;

export const createClient = (repository: Repository, octokit: Octokit) => {
  return {
    fetchRuns: async (page: number) => {
      return await octokit.rest.actions.listWorkflowRunsForRepo({
        ...repository,
        per_page: 100,
        page,
      });
    },
    fetchArtifacts: async (runId: number) => {
      const input = { ...repository, run_id: runId, per_page: 100 };
      return octokit.rest.actions.listWorkflowRunArtifacts(input);
    },
    downloadArtifact: async (artifactId: number) => {
      return octokit.rest.actions.downloadArtifact({
        ...repository,
        artifact_id: artifactId,
        archive_format: 'zip',
      });
    },
    postComment: async (issueNumber: number, comment: string) => {
      return octokit.rest.issues.createComment({ ...repository, issue_number: issueNumber, body: comment });
    },
  };
};
