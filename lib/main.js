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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const github = __importStar(require("@actions/github"));
const artifact = __importStar(require("@actions/artifact"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cpx_1 = __importDefault(require("cpx"));
const glob_1 = require("glob");
const make_dir_1 = __importDefault(require("make-dir"));
const logger_1 = require("./logger");
const git_1 = require("./git");
const report_1 = require("./report");
const config_1 = require("./config");
const compare = require('reg-cli');
const NodeZip = require('node-zip');
const DIFF_DIR_NAME = '0_diff';
const ACTUAL_DIR_NAME = '1_actual';
const EXPECTED_DIR_NAME = '2_expected';
const config = (0, config_1.getConfig)();
const artifactClient = artifact.create();
const octokit = github.getOctokit(config.githubToken);
const { repo } = github.context;
const readEvent = () => {
    try {
        if (process.env.GITHUB_EVENT_PATH) {
            return JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
        }
    }
    catch (e) { }
};
const event = readEvent();
logger_1.log.info(`event = `, event);
if (!event) {
    throw new Error('Failed to get github event.json.');
}
const actual = config.imageDirectoryPath;
logger_1.log.info(`actual directory is ${actual}`);
const findCurrentAndTargetRuns = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    let currentRun = null;
    const currentHash = (_d = ((_a = event.after) !== null && _a !== void 0 ? _a : (_c = (_b = event === null || event === void 0 ? void 0 : event.pull_request) === null || _b === void 0 ? void 0 : _b.head) === null || _c === void 0 ? void 0 : _c.sha)) === null || _d === void 0 ? void 0 : _d.slice(0, 7);
    logger_1.log.info(`event.after = ${event.after} head sha = ${(_f = (_e = event.pull_request) === null || _e === void 0 ? void 0 : _e.head) === null || _f === void 0 ? void 0 : _f.sha}`);
    if (!currentHash)
        return null;
    let page = 0;
    while (true) {
        const runs = yield octokit.rest.actions.listWorkflowRunsForRepo(Object.assign(Object.assign({}, repo), { per_page: 100, page: page++ }));
        if (!currentRun) {
            const run = runs.data.workflow_runs.find(run => run.head_sha.startsWith(currentHash));
            if (run) {
                currentRun = run;
                logger_1.log.info(`currentRun = `, currentRun);
            }
        }
        if (!event.pull_request)
            return null;
        const targetHash = yield (0, git_1.findTargetHash)(event.pull_request.base.sha, event.pull_request.head.sha);
        const targetHashShort = targetHash.slice(0, 7);
        logger_1.log.info(`targetHash = ${targetHash}`);
        const targetRun = runs.data.workflow_runs.find(run => run.head_sha.startsWith(targetHashShort));
        logger_1.log.debug('runs = ', runs.data.workflow_runs.length);
        logger_1.log.info(`targetRun = `, targetRun);
        if (targetRun && currentRun) {
            return { current: currentRun, target: targetRun };
        }
        if (runs.data.workflow_runs.length < 100) {
            logger_1.log.info('Failed to find target run');
            return null;
        }
    }
});
const downloadExpectedImages = (octokit, repo, latestArtifactId) => __awaiter(void 0, void 0, void 0, function* () {
    const zip = yield octokit.rest.actions.downloadArtifact(Object.assign(Object.assign({}, repo), { artifact_id: latestArtifactId, archive_format: 'zip' }));
    const files = new NodeZip(zip.data, { base64: false, checkCRC32: true });
    yield Promise.all(Object.keys(files.files)
        .map(key => files.files[key])
        .filter(file => !file.dir && file.name.startsWith(ACTUAL_DIR_NAME))
        .map((file) => __awaiter(void 0, void 0, void 0, function* () {
        const f = path.join('__reg__', file.name.replace(ACTUAL_DIR_NAME, EXPECTED_DIR_NAME));
        yield (0, make_dir_1.default)(path.dirname(f));
        yield fs.promises.writeFile(f, str2ab(file._data));
    })));
});
const copyImages = () => {
    cpx_1.default.copySync(path.join(actual, `**/*.{png,jpg,jpeg,tiff,bmp,gif}`), `./__reg__/${ACTUAL_DIR_NAME}`);
};
const compareAndUpload = () => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise(resolve => {
        compare({
            actualDir: `./__reg__/${ACTUAL_DIR_NAME}`,
            expectedDir: `./__reg__/${EXPECTED_DIR_NAME}`,
            diffDir: `./__reg__/${DIFF_DIR_NAME}`,
            json: './__reg__/0',
            update: false,
            ignoreChange: true,
            urlPrefix: '',
            thresholdPixel: config.thresholdPixel,
            thresholdRate: config.thresholdRate,
            matchingThreshold: config.matchingThreshold,
            enableAntialias: config.enableAntialias,
        }).on('complete', (result) => __awaiter(void 0, void 0, void 0, function* () {
            logger_1.log.debug('compare result', result);
            const files = (0, glob_1.sync)('./__reg__/**/*');
            logger_1.log.info('Start upload artifact');
            logger_1.log.debug(files);
            try {
                yield artifactClient.uploadArtifact('reg', files, './__reg__');
            }
            catch (e) {
                logger_1.log.error(e);
                throw new Error('Failed to upload artifact');
            }
            logger_1.log.info('Succeeded to upload artifact');
            resolve(result);
        }));
    });
});
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, make_dir_1.default)('./__reg__');
    // Copy actual images
    copyImages();
    if (typeof event.number === 'undefined') {
        logger_1.log.info(`event number is not detected.`);
        yield compareAndUpload();
        return;
    }
    const runs = yield findCurrentAndTargetRuns();
    if (!runs) {
        logger_1.log.error('Failed to find current or target runs');
        yield compareAndUpload();
        return;
    }
    logger_1.log.info(`currentRun = `, runs.current);
    const res = yield octokit.rest.actions.listWorkflowRunArtifacts(Object.assign(Object.assign({}, repo), { run_id: runs.target.id, per_page: 100 }));
    logger_1.log.debug('res = ', res);
    const { artifacts } = res.data;
    const latest = artifacts[artifacts.length - 1];
    logger_1.log.debug('latest artifact = ', latest);
    if (latest) {
        yield downloadExpectedImages(octokit, repo, latest.id);
    }
    const result = yield compareAndUpload();
    if (event.number == null)
        return;
    const [owner, reponame] = event.repository.full_name.split('/');
    const url = (0, report_1.createReportURL)(owner, reponame, runs.current.id);
    logger_1.log.info(`This report URL is ${url}`);
    let body = '';
    const currentHash = runs.current.head_sha;
    const targetHash = runs.target.head_sha;
    const currentHashShort = currentHash.slice(0, 7);
    const targetHashShort = targetHash.slice(0, 7);
    if (result.failedItems.length === 0 && result.newItems.length === 0 && result.deletedItems.length === 0) {
        body = `This report was generated by comparing [${currentHashShort}](https://github.com/${owner}/${reponame}/commit/${currentHash}) and [${targetHashShort}](https://github.com/${owner}/${reponame}/commit/${targetHash}).
If you would like to check difference, please check [here](https://github.com/${owner}/${reponame}/compare/${currentHashShort}..${targetHashShort}).

✨✨ That's perfect, there is no visual difference! ✨✨
Check out the report [here](${url}).

| item | number |  |
|:-----------|:------------:|:------------:|
| pass       | ${result.passedItems.length}        |   |
| change       | ${result.failedItems.length}        |   |
| new   | ${result.newItems.length}     |     |
| delete  | ${result.deletedItems.length}     |     |
`;
    }
    else {
        body = `This report was generated by comparing [${currentHashShort}](https://github.com/${owner}/${reponame}/commit/${currentHash}) and [${targetHashShort}](https://github.com/${owner}/${reponame}/commit/${targetHash}).
If you would like to check difference, please check [here](https://github.com/${owner}/${reponame}/compare/${currentHashShort}..${targetHashShort}).    

Check out the report [here](${url}).

| item | number |  |
|:-----------|:------------:|:------------:|
| pass       | ${result.passedItems.length}        |   |
| change       | ${result.failedItems.length}        |   |
| new   | ${result.newItems.length}     |     |
| delete  | ${result.deletedItems.length}     |     |
`;
    }
    yield octokit.rest.issues.createComment(Object.assign(Object.assign({}, repo), { issue_number: event.number, body }));
});
run();
function str2ab(str) {
    const array = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
        array[i] = str.charCodeAt(i);
    }
    return array;
}
