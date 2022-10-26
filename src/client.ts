import * as github from '@actions/github';
import * as artifact from '@actions/artifact';

import { Repository } from './repository';
import * as constants from './constants';
import { workspace } from './path';

export type Octokit = ReturnType<typeof github.getOctokit>;

export const createClient = (repository: Repository, octokit: Octokit) => {
  const artifactClient = artifact.create();

  return {
    fetchRuns: async (page: number) => {
      return await octokit.rest.actions.listWorkflowRunsForRepo({
        ...repository,
        per_page: 50,
        page,
      });
    },
    fetchArtifacts: async (runId: number) => {
      const input = { ...repository, run_id: runId, per_page: 50 };
      return octokit.rest.actions.listWorkflowRunArtifacts(input);
    },
    uploadArtifact: async (files: string[]) => {
      const _ = await artifactClient.uploadArtifact(constants.ARTIFACT_NAME, files, workspace());
      return;
    },
    downloadArtifact: async (artifactId: number) => {
      return octokit.rest.actions.downloadArtifact({
        ...repository,
        artifact_id: artifactId,
        archive_format: 'zip',
      });
    },
    postComment: async (issueNumber: number, comment: string) => {
      const _ = await octokit.rest.issues.createComment({ ...repository, issue_number: issueNumber, body: comment });
      return;
    },
  };
};
