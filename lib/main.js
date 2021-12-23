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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const artifact = __importStar(require("@actions/artifact"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const cpx_1 = __importDefault(require("cpx"));
const make_dir_1 = __importDefault(require("make-dir"));
const util_1 = require("util");
const logger_1 = require("./logger");
const compare = require('reg-cli');
const NodeZip = require('node-zip');
const artifactClient = artifact.create();
const token = core.getInput('secret');
const octokit = github.getOctokit(token);
const writeFileAsync = (0, util_1.promisify)(fs.writeFile);
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
    throw new Error('Failed to get github event.json..');
}
const actual = core.getInput('actual-directory-path');
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
        const targetHash = (0, child_process_1.execSync)(`git merge-base -a origin/${event.pull_request.base.ref} origin/${event.pull_request.head.ref}`, { encoding: 'utf8' }).slice(0, 7);
        logger_1.log.info(`targetHash = ${targetHash}`);
        const targetRun = runs.data.workflow_runs.find(run => run.head_sha.startsWith(targetHash));
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
const copyImages = () => {
    cpx_1.default.copySync(path.join(actual, `**/*.{png,jpg,jpeg,tiff,bmp,gif}`), path.join(__dirname, './__reg__/actual'));
};
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, make_dir_1.default)(path.join(__dirname, './__reg__'));
    if (typeof event.number === 'undefined') {
        return;
    }
    const runs = yield findCurrentAndTargetRuns();
    if (!runs) {
        logger_1.log.error('Failed to find current or target runs');
        return;
    }
    logger_1.log.info(`currentRun = `, runs.current);
    // Copy actual images
    copyImages();
    const res = yield octokit.rest.actions.listWorkflowRunArtifacts(Object.assign(Object.assign({}, repo), { run_id: runs.target.id, per_page: 100 }));
    logger_1.log.debug('res = ', res);
    const { artifacts } = res.data;
    const latest = artifacts[artifacts.length - 1];
    logger_1.log.debug('latest artifact = ', latest);
    const zip = yield octokit.rest.actions.downloadArtifact(Object.assign(Object.assign({}, repo), { artifact_id: latest.id, archive_format: 'zip' }));
    const files = new NodeZip(zip.data, { base64: false, checkCRC32: true });
    yield Promise.all(Object.keys(files.files)
        .map(key => files.files[key])
        .filter(file => !file.dir)
        .map((file) => __awaiter(void 0, void 0, void 0, function* () {
        const f = path.join(__dirname, '__reg__', 'expected', path.basename(file.name));
        yield (0, make_dir_1.default)(path.dirname(f));
        yield writeFileAsync(f, str2ab(file._data));
    })));
    const emitter = compare({
        actualDir: path.join(__dirname, './__reg__/actual'),
        expectedDir: path.join(__dirname, './__reg__/expected'),
        diffDir: path.join(__dirname, './__reg__/diff'),
        json: path.join(__dirname, './__reg__/0'),
        update: false,
        ignoreChange: true,
        urlPrefix: '',
    });
    emitter.on('compare', (compareItem) => __awaiter(void 0, void 0, void 0, function* () { }));
    emitter.on('complete', (result) => __awaiter(void 0, void 0, void 0, function* () {
        logger_1.log.debug('compare result', result);
        const [owner, reponame] = event.repository.full_name.split('/');
        const url = `https://bokuweb.github.io/reg-actions-report/?owner=${owner}&repository=${reponame}&run_id=${runs.current.id}`;
        const files = [
            path.join(__dirname, './__reg__/0'),
            result.actualItems.map(p => path.join(__dirname, `./__reg__/actual`, p)),
            // result.expectedItems.map(p => path.join('./__reg__/expected', p)),
            // result.diffItems.map(p => path.join('./__reg__/diff', p)),
        ];
        logger_1.log.info('Start upload artifact');
        try {
            yield artifactClient.uploadArtifact('reg', files, __dirname);
        }
        catch (e) {
            logger_1.log.error(e);
            throw new Error('Failed to upload artifact.');
        }
        logger_1.log.info('Succeeded to upload artifact');
        if (event.number == null)
            return;
        let body = '';
        if (result.failedItems.length === 0 && result.newItems === 0 && result.deletedItems === 0) {
            body = `✨✨ That's perfect, there is no visual difference! ✨✨
      Check out the report [here](${url}).`;
        }
        else {
            body = `Check out the report [here](${url}).
          
| item | number |  |
|:-----------|:------------:|:------------:|
| passed       | ${result.passedItems.length}        |   |
| failed       | ${result.failedItems.length}        |   |
| new   | ${result.newItems.length}     |     |
| delete  | ${result.deletedItems.length}     |     |
      `;
        }
        yield octokit.rest.issues.createComment(Object.assign(Object.assign({}, repo), { issue_number: event.number, body }));
    }));
});
run();
function str2ab(str) {
    const array = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
        array[i] = str.charCodeAt(i);
    }
    return array;
}
