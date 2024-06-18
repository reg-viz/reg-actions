import * as github from '@actions/github';
import { DefaultArtifactClient } from '@actions/artifact';
import { backOff } from 'exponential-backoff';
import { summary } from '@actions/core';

import { Repository } from './repository';
import { workspace } from './path';

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
    listComments: async (issueNumber: number): Promise<{ node_id: string; body?: string | undefined }[]> => {
      return backOff(
        () =>
          octokit.paginate(
            octokit.rest.issues.listComments,
            {
              ...repository,
              issue_number: issueNumber,
              per_page: 100,
            },
            r => r.data,
          ),
        { numOfAttempts: 5 },
      );
    },
    minimizeOutdatedComment: async (nodeId: string) => {
      const _ = await backOff(
        () =>
          octokit.graphql(
            `
mutation($input: MinimizeCommentInput!) {
  minimizeComment(input: $input) {
    minimizedComment {
      isMinimized
    }
  }
}
`,
            {
              input: {
                subjectId: nodeId,
                classifier: 'OUTDATED',
              },
            },
          ),
        { numOfAttempts: 5 },
      );
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
