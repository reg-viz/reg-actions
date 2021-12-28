const REPORT_PAGE = 'https://reg-actions-report.pages.dev/';

export const createReportURL = (owner: string, reponame: string, runId: number) => {
  return `${REPORT_PAGE}?owner=${owner}&repository=${reponame}&run_id=${runId}`;
};
