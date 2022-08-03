const REPORT_PAGE = 'https://reg-actions.pages.dev/';

export const createReportURL = (owner: string, reponame: string, runId: number) => {
  return `${REPORT_PAGE}?owner=${owner}&repository=${reponame}&run_id=${runId}`;
};
export const createCustomReportURL = (customReportPage: string, branchName: string) => {
  return `${customReportPage}/${branchName}`;
};
