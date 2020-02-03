"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const cpx_1 = __importDefault(require("cpx"));
const make_dir_1 = __importDefault(require("make-dir"));
const util_1 = require("util");
const compare = require("reg-cli");
const NodeZip = require("node-zip");
const token = core.getInput("secret");
const octokit = new github.GitHub(token);
const writeFileAsync = util_1.promisify(fs.writeFile);
const { repo } = github.context;
let event;
try {
    if (process.env.GITHUB_EVENT_PATH) {
        event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    }
}
catch (e) { }
if (!event) {
    throw new Error("Failed to get github event.json..");
}
const actual = core.getInput("actual-directory-path");
// TODO: fetch all run
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    const runs = yield octokit.actions.listRepoWorkflowRuns(Object.assign(Object.assign({}, repo), { per_page: 100 }));
    const currentHash = (event.after ||
        (event.pull_request &&
            event.pull_request.head &&
            event.pull_request.head.sha)).slice(0, 7);
    const currentRun = runs.data.workflow_runs.find(run => run.head_sha.startsWith(currentHash));
    if (!currentRun)
        return;
    cpx_1.default.copySync(path.join(actual, `**/*.{png,jpg,jpeg,tiff,bmp,gif}`), "./__reg__/actual");
    // Not PR
    if (typeof event.number === "undefined") {
        //    await publish();
        return;
    }
    const targetHash = child_process_1.execSync(`git merge-base -a origin/${event.pull_request.base.ref} origin/${event.pull_request.head.ref}`, { encoding: "utf8" }).slice(0, 7);
    const targetRun = runs.data.workflow_runs.find(run => run.head_sha.startsWith(targetHash));
    if (!targetRun) {
        console.error("Failed to find target run");
        return;
    }
    // TODO: fetch all artifacts
    const res = yield octokit.actions.listWorkflowRunArtifacts(Object.assign(Object.assign({}, repo), { run_id: targetRun.id, per_page: 100 }));
    // Octokit's type definition is wrong now.
    const { artifacts } = res.data;
    const latest = artifacts[artifacts.length - 1];
    const zip = yield octokit.actions.downloadArtifact(Object.assign(Object.assign({}, repo), { artifact_id: latest.id, archive_format: "zip" }));
    const files = new NodeZip(zip.data, {
        base64: false,
        checkCRC32: true
    });
    yield Promise.all(Object.keys(files.files)
        .map(key => files.files[key])
        .filter(file => !file.dir)
        .map((file) => __awaiter(void 0, void 0, void 0, function* () {
        const f = path.join("__reg__", "expected", path.basename(file.name));
        yield make_dir_1.default(path.dirname(f));
        yield writeFileAsync(f, str2ab(file._data));
    })));
    const emitter = compare({
        actualDir: "./__reg__/actual",
        expectedDir: "./__reg__/expected",
        diffDir: "./__reg__/diff",
        json: "./__reg__/reg.json",
        report: "./__reg__/index.html",
        update: false,
        ignoreChange: true,
        urlPrefix: ""
    });
    emitter.on("compare", (compareItem) => __awaiter(void 0, void 0, void 0, function* () { }));
    emitter.on("complete", (result) => __awaiter(void 0, void 0, void 0, function* () {
        const [owner, reponame] = event.repository.full_name.split("/");
        const url = `https://bokuweb.github.io/reg-action-report/?owner=${owner}&repository=${reponame}&run_id=${currentRun.id}`;
        yield octokit.issues.createComment(Object.assign(Object.assign({}, repo), { issue_number: event.number, body: url }));
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
