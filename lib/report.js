"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReportURL = void 0;
const REPORT_PAGE = 'https://reg-actions.pages.dev/';
const createReportURL = (owner, reponame, runId) => {
    return `${REPORT_PAGE}?owner=${owner}&repository=${reponame}&run_id=${runId}`;
};
exports.createReportURL = createReportURL;
