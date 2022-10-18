import * as github from '@actions/github';
import * as artifact from '@actions/artifact';
import { createCommentOrUpdate } from '@superactions/comment';
import * as superArtifact from '@superactions/artifact';

import { Repository } from './repository';
import * as constants from './constants';
import { workspace } from './path';

export type Octokit = ReturnType<typeof github.getOctokit>;

export const createClient = (repository: Repository, octokit: Octokit, ghToken: string) => {
  const artifactClient = artifact.create();
  const superArtifactClient = superArtifact.create({ ghToken: ghToken });

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
    uploadArtifact: async (files: string[]) => {
      const _ = await artifactClient.uploadArtifact(constants.ARTIFACT_NAME, files, workspace());
      return;
    },
    uploadWebsite: async (dir: string) => {
      await superArtifactClient.uploadDirectory('reg', dir);

      return await superArtifactClient.getPageUrl('reg/report/index.html');
    },
    downloadArtifact: async (artifactId: number) => {
      return octokit.rest.actions.downloadArtifact({
        ...repository,
        artifact_id: artifactId,
        archive_format: 'zip',
      });
    },
    postComment: async (_issueNumber: number, comment: string) => {
      await createCommentOrUpdate({ message: comment, githubToken: ghToken, uniqueAppId: 'vis-reg-storybook' });
      return;
    },
  };
};
