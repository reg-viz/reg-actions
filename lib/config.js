"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = void 0;
const core = __importStar(require("@actions/core"));
const fs_1 = require("fs");
const validateGitHubToken = (githubToken) => {
    if (!githubToken) {
        throw new Error(`'github-token' is not set. Please give API token.`);
    }
};
const validateImageDirPath = (path) => {
    if (!path) {
        throw new Error(`'image-directory-path' is not set. Please specify path to image directory.`);
    }
    try {
        const s = (0, fs_1.statSync)(path);
        if (s.isDirectory())
            return;
    }
    catch (_) {
        throw new Error(`'image-directory-path' is not directory. Please specify path to image directory.`);
    }
};
const getBoolInput = (name) => {
    const input = core.getInput(name);
    if (!input) {
        return false;
    }
    if (input !== 'true' && input !== 'false') {
        throw new Error(`'${name}' input must be boolean value 'true' or 'false' but got '${input}'`);
    }
    return input === 'true';
};
const getNumberInput = (name) => {
    const n = core.getInput(name);
    if (!n)
        return null;
    if (typeof n === 'number')
        return n;
    throw new Error(`'${name}' input must be number value but got '${n}'`);
};
const validateMatchingThreshold = (n) => {
    if (n < 0 || n > 1) {
        throw new Error(`'matching-threshold' input must be 0 to 1 '${n}'`);
    }
};
const validateThresholdRate = (n) => {
    if (n < 0 || n > 1) {
        throw new Error(`'threshold-rate' input must be 0 to 1 '${n}'`);
    }
};
const getConfig = () => {
    var _a, _b, _c;
    const githubToken = core.getInput('github-token');
    const imageDirectoryPath = core.getInput('image-directory-path');
    validateGitHubToken(githubToken);
    validateImageDirPath(imageDirectoryPath);
    const matchingThreshold = (_a = getNumberInput('matching-threshold')) !== null && _a !== void 0 ? _a : 0;
    const thresholdRate = (_b = getNumberInput('threshold-rate')) !== null && _b !== void 0 ? _b : 0;
    const thresholdPixel = (_c = getNumberInput('threshold-pixel')) !== null && _c !== void 0 ? _c : 0;
    validateMatchingThreshold(matchingThreshold);
    validateThresholdRate(thresholdRate);
    return {
        githubToken,
        imageDirectoryPath,
        enableAntialias: getBoolInput(core.getInput('enableAntialias')),
        matchingThreshold,
        thresholdRate,
        thresholdPixel,
    };
};
exports.getConfig = getConfig;
