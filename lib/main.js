var $sSnou$actionscore = require("@actions/core");
var $sSnou$actionsgithub = require("@actions/github");
var $sSnou$fs = require("fs");
var $sSnou$path = require("path");
var $sSnou$child_process = require("child_process");
var $sSnou$cpx = require("cpx");
var $sSnou$makedir = require("make-dir");
var $sSnou$util = require("util");
var $sSnou$regcli = require("reg-cli");
var $sSnou$nodezip = require("node-zip");

function $parcel$interopDefault(a) {
  return a && a.__esModule ? a.default : a;
}










const $c3a19d935c27f6bb$var$token = $sSnou$actionscore.getInput("secret");
const $c3a19d935c27f6bb$var$octokit = new $sSnou$actionsgithub.GitHub($c3a19d935c27f6bb$var$token);
const $c3a19d935c27f6bb$var$writeFileAsync = $sSnou$util.promisify($sSnou$fs.writeFile);
const { repo: $c3a19d935c27f6bb$var$repo  } = $sSnou$actionsgithub.context;
let $c3a19d935c27f6bb$var$event;
try {
    if (process.env.GITHUB_EVENT_PATH) $c3a19d935c27f6bb$var$event = JSON.parse($sSnou$fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
} catch (e) {
}
if (!$c3a19d935c27f6bb$var$event) throw new Error("Failed to get github event.json..");
const $c3a19d935c27f6bb$var$actual = $sSnou$actionscore.getInput("actual-directory-path");
// TODO: fetch all run
const $c3a19d935c27f6bb$var$run = async ()=>{
    var ref, ref1;
    const runs = await $c3a19d935c27f6bb$var$octokit.actions.listRepoWorkflowRuns({
        ...$c3a19d935c27f6bb$var$repo,
        per_page: 100
    });
    const sha = $c3a19d935c27f6bb$var$event.after || ((ref = $c3a19d935c27f6bb$var$event.pull_request) === null || ref === void 0 ? void 0 : (ref1 = ref.head) === null || ref1 === void 0 ? void 0 : ref1.sha);
    if (!sha) return;
    const currentHash = sha.slice(0, 7);
    const currentRun = runs.data.workflow_runs.find((run)=>run.head_sha.startsWith(currentHash)
    );
    if (!currentRun) return;
    ($parcel$interopDefault($sSnou$cpx)).copySync($sSnou$path.join($c3a19d935c27f6bb$var$actual, `**/*.{png,jpg,jpeg,tiff,bmp,gif}`), "./__reg__/actual");
    // Not PR
    if (typeof $c3a19d935c27f6bb$var$event.number === "undefined") return;
    const targetHash = $sSnou$child_process.execSync(`git merge-base -a origin/${$c3a19d935c27f6bb$var$event.pull_request.base.ref} origin/${$c3a19d935c27f6bb$var$event.pull_request.head.ref}`, {
        encoding: "utf8"
    }).slice(0, 7);
    const targetRun = runs.data.workflow_runs.find((run)=>run.head_sha.startsWith(targetHash)
    );
    if (!targetRun) {
        console.error("Failed to find target run");
        return;
    }
    // TODO: fetch all artifacts
    const res = await $c3a19d935c27f6bb$var$octokit.actions.listWorkflowRunArtifacts({
        ...$c3a19d935c27f6bb$var$repo,
        run_id: targetRun.id,
        per_page: 100
    });
    // Octokit's type definition is wrong now.
    const { artifacts: artifacts  } = res.data;
    const latest = artifacts[artifacts.length - 1];
    const zip = await $c3a19d935c27f6bb$var$octokit.actions.downloadArtifact({
        ...$c3a19d935c27f6bb$var$repo,
        artifact_id: latest.id,
        archive_format: "zip"
    });
    const files = new $sSnou$nodezip(zip.data, {
        base64: false,
        checkCRC32: true
    });
    await Promise.all(Object.keys(files.files).map((key)=>files.files[key]
    ).filter((file)=>!file.dir
    ).map(async (file)=>{
        const f = $sSnou$path.join("__reg__", "expected", $sSnou$path.basename(file.name));
        await ($parcel$interopDefault($sSnou$makedir))($sSnou$path.dirname(f));
        await $c3a19d935c27f6bb$var$writeFileAsync(f, $c3a19d935c27f6bb$var$str2ab(file._data));
    }));
    const emitter = $sSnou$regcli({
        actualDir: "./__reg__/actual",
        expectedDir: "./__reg__/expected",
        diffDir: "./__reg__/diff",
        json: "./__reg__/0",
        update: false,
        ignoreChange: true,
        urlPrefix: ""
    });
    emitter.on("compare", async (compareItem)=>{
    });
    emitter.on("complete", async ()=>{
        const [owner, repo] = $c3a19d935c27f6bb$var$event.repository.full_name.split("/");
        const url = `https://bokuweb.github.io/reg-action-report/?owner=${owner}&repository=${repo}&run_id=${currentRun.id}`;
        await $c3a19d935c27f6bb$var$octokit.issues.createComment({
            ...repo,
            issue_number: $c3a19d935c27f6bb$var$event.number,
            body: url
        });
    });
};
$c3a19d935c27f6bb$var$run();
function $c3a19d935c27f6bb$var$str2ab(str) {
    const array = new Uint8Array(str.length);
    for(var i = 0; i < str.length; i++)array[i] = str.charCodeAt(i);
    return array;
}


//# sourceMappingURL=main.js.map
