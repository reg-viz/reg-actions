import * as core from '@actions/core';
import { statSync } from 'fs';
import { dirname } from 'path';

export interface Config {
  imageDirectoryPath: string;
  githubToken: string;
  enableAntialias: boolean;
  matchingThreshold: number;
  thresholdRate: number;
  thresholdPixel: number;
  targetHash: string | null;
  customReportPage: string | null;
  reportFilePath: string | null;
}

const validateGitHubToken = (githubToken: string | undefined) => {
  if (!githubToken) {
    throw new Error(`'github-token' is not set. Please give API token.`);
  }
};

const validateImageDirPath = (path: string | undefined) => {
  if (!path) {
    throw new Error(`'image-directory-path' is not set. Please specify path to image directory.`);
  }
  try {
    const s = statSync(path);
    if (s.isDirectory()) return;
  } catch (_) {
    throw new Error(`'image-directory-path' is not directory. Please specify path to image directory.`);
  }
};

const getBoolInput = (name: string): boolean => {
  const input = core.getInput(name);
  if (!input) {
    return false;
  }
  if (input !== 'true' && input !== 'false') {
    throw new Error(`'${name}' input must be boolean value 'true' or 'false' but got '${input}'`);
  }
  return input === 'true';
};

const getNumberInput = (name: string): number | null => {
  const v = core.getInput(name);
  if (!v) return null;
  const n = Number(v);
  if (typeof n === 'number') return n;
  throw new Error(`'${name}' input must be number value but got '${n}'`);
};

const validateMatchingThreshold = (n: number) => {
  if (!(n >= 0 && n <= 1)) {
    throw new Error(`'matching-threshold' input must be 0 to 1 '${n}'`);
  }
};

const validateThresholdRate = (n: number) => {
  if (!(n >= 0 && n <= 1)) {
    throw new Error(`'threshold-rate' input must be 0 to 1 '${n}'`);
  }
};

const validateTargetHash = (h: string | null) => {
  if (!h) return;
  if (!/[0-9a-f]{5,40}/.test(h)) {
    throw new Error(`'target-hash' input must be commit hash but got '${h}'`);
  }
};

const validateCustomReportPage = (link: string | null) => {
  if (!link) return;
  if (!/^(?:http(s)?:\/\/)[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/.test(link)) {
    throw new Error(`'custom-report-page' input must be a valid url '${link}'`);
  }
};

const validateReportFilePath = (path: string | undefined) => {
  if(path === undefined || path === '') {
    return;
  }
  try {
    const s = statSync(dirname(path));
    if (s.isDirectory()) return;
      else throw null;
  } catch (_) {
    throw new Error(`'report-file-path' is not in a valid directory. Please specify path to report file.`);
  }
};

export const getConfig = (): Config => {
  const githubToken = core.getInput('github-token');
  const imageDirectoryPath = core.getInput('image-directory-path');
  validateGitHubToken(githubToken);
  validateImageDirPath(imageDirectoryPath);
  const matchingThreshold = getNumberInput('matching-threshold') ?? 0;
  const thresholdRate = getNumberInput('threshold-rate') ?? 0;
  const thresholdPixel = getNumberInput('threshold-pixel') ?? 0;
  validateMatchingThreshold(matchingThreshold);
  validateThresholdRate(thresholdRate);
  const targetHash = core.getInput('target-hash') || null;
  validateTargetHash(targetHash);
  const customReportPage = core.getInput('custom-report-page') || null;
  validateCustomReportPage(customReportPage)
  const reportFilePath = core.getInput('report-file-path');
  validateReportFilePath(reportFilePath);

  return {
    githubToken,
    imageDirectoryPath,
    enableAntialias: getBoolInput(core.getInput('enableAntialias')),
    matchingThreshold,
    thresholdRate,
    thresholdPixel,
    targetHash,
    customReportPage,
    reportFilePath
  };
};
