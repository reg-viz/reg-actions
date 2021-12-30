import * as github from '@actions/github';

import { Repository } from './repository';

type Octokit = ReturnType<typeof github.getOctokit>;

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
      return await octokit.rest.actions.listWorkflowRunArtifacts(input);
    },
  };
};
