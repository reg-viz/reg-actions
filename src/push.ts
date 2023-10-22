// This file is based on https://github.com/s0/git-publish-subdir-action
// MIT License
//
// Copyright (c) 2018 Sam Lanning
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { stream as fgStream } from 'fast-glob';
// import fsModule, { promises as fs } from 'fs';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import cpx from 'cpx';

// import git from 'isomorphic-git';
import { mkdirP, cp } from '@actions/io';
import { add, checkout, clone, commit, configureEmail, configureName, fetchOrigin, hasBranch, push } from './git';
import { log } from './logger';
import { CompareOutput } from './compare';
import { workspace } from './path';
import * as constants from './constants';

// export type Console = {
//   readonly log: (...msg: unknown[]) => void;
//   readonly error: (...msg: unknown[]) => void;
//   readonly warn: (...msg: unknown[]) => void;
// };

/**
 * Custom wrapper around the child_process module
 */
// export const exec = async (
//   cmd: string,
//   opts: {
//     env?: any;
//     cwd?: string;
//     log: Console;
//   },
// ) => {
//   const { log } = opts;
//   const env = opts?.env || {};
//   const ps = child_process.spawn('bash', ['-c', cmd], {
//     env: {
//       HOME: process.env.HOME,
//       ...env,
//     },
//     cwd: opts.cwd,
//     stdio: ['pipe', 'pipe', 'pipe'],
//   });
//
//   const output = {
//     stderr: '',
//     stdout: '',
//   };
//
//   // We won't be providing any input to command
//   ps.stdin.end();
//   ps.stdout.on('data', data => {
//     output.stdout += data;
//     log.log(`data`, data.toString());
//   });
//   ps.stderr.on('data', data => {
//     output.stderr += data;
//     log.error(data.toString());
//   });
//
//   return new Promise<{
//     stderr: string;
//     stdout: string;
//   }>((resolve, reject) =>
//     ps.on('close', code => {
//       if (code !== 0) {
//         reject(new Error('Process exited with code: ' + code + ':\n' + output.stderr));
//       } else {
//         resolve(output);
//       }
//     }),
//   );
// };

export type PushImagesInput = {
  githubToken: string;
  runId: number;
  result: CompareOutput;
  branch: string;
  // sourceDir: string;
  targetDir: string;
  env: EnvironmentVariables;
  commitName?: string;
  commitEmail?: string;
};

export interface EnvironmentVariables {
  /**
   * The URL of the repository to push to, either:
   *
   * * an ssh URL to a repository
   * * the string `"self"`
   */
  // REPO?: string;
  /**
   * The name of the branch to push to
   */
  // BRANCH?: string;
  /**
   * Which subdirectory in the repository to we want to push as the contents of the branch
   */
  // FOLDER?: string;
  /**
   * An optional string to change the directory where the files are copied to
   */
  // TARGET_DIR?: string;
  /**
   * The private key to use for publishing if REPO is an SSH repo
   */
  // SSH_PRIVATE_KEY?: string;
  /**
   * The file path of a known_hosts file with fingerprint of the relevant server
   */
  // KNOWN_HOSTS_FILE?: string;
  /**
   * The GITHUB_TOKEN secret
   */
  // GITHUB_TOKEN?: string;
  /**
   * Set to "true" to avoid pushing commits that don't change any files.
   *
   * This is useful for example when you want to be able to easily identify
   * which upstream changes resulted in changes to this repository.
   */
  // SKIP_EMPTY_COMMITS?: string;
  /**
   * An optional template string to use for the commit message,
   * if not provided, a default template is used.
   *
   * A number of placeholders are available to use in template strings:
   * * `{target-branch}` - the name of the target branch being updated
   * * `{sha}` - the 7-character sha of the HEAD of the current branch
   * * `{long-sha}` - the full sha of the HEAD of the current branch
   * * `{msg}` - the commit message for the HEAD of the current branch
   */
  // MESSAGE?: string;
  /**
   * An optional path to a file to use as a list of globs defining which files
   * to delete when clearing the target branch
   */
  // CLEAR_GLOBS_FILE?: string;
  /**
   * An optional string in git-check-ref-format to use for tagging the commit
   */
  // TAG?: string;

  /**
   * An optional string to use as the commiter name on the git commit.
   */
  // COMMIT_NAME?: string;

  /**
   * An optional string to use as the commiter email on the git commit.
   */
  // COMMIT_EMAIL?: string;

  // Implicit environment variables passed by GitHub
  GITHUB_REPOSITORY?: string;
  GITHUB_EVENT_PATH?: string;

  /** The name of the person / app that that initiated the workflow */
  GITHUB_ACTOR?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvironmentVariables {}
  }
}

const DEFAULT_MESSAGE = 'Update {target-branch} to output generated at {sha}';

// Error messages

// const KNOWN_HOSTS_WARNING = `
// [warning] KNOWN_HOSTS_FILE not set
// This will probably mean that host verification will fail later on
// `;

// const KNOWN_HOSTS_ERROR = (host: string) => `
// [error] Host key verification failed!
// This is probably because you forgot to supply a value for KNOWN_HOSTS_FILE
// or the file is invalid or doesn't correctly verify the host ${host}
// `;

// const SSH_KEY_ERROR = `
// [error] Permission denied (publickey)
// Make sure that the ssh private key is set correctly, and
// that the public key has been added to the target repo
// `;

// const INVALID_KEY_ERROR = `
// [error] Error loading key: invalid format
// Please check that you're setting the environment variable
// SSH_PRIVATE_KEY correctly
// `;

// Paths

// const REPO_SELF = 'self';
// const RESOURCES = path.join(path.dirname(__dirname), 'resources');
// const KNOWN_HOSTS_GITHUB = path.join(RESOURCES, 'known_hosts_github.com');
// const SSH_FOLDER = path.join(homedir(), '.ssh');
// const KNOWN_HOSTS_TARGET = path.join(SSH_FOLDER, 'known_hosts');

// const SSH_AGENT_PID_EXTRACT = /SSH_AGENT_PID=([0-9]+);/;

interface BaseConfig {
  branch: string;
  // sourceDir: string;
  repo: string;
  // skipEmptyCommits: boolean;
  // message: string;
  // tag?: string;
}

// interface SshConfig extends BaseConfig {
//   mode: 'ssh';
//   parsedUrl: gitUrlParse.GitUrl;
//   privateKey: string;
//   knownHostsFile?: string;
// }

interface Config extends BaseConfig {
  // mode: 'self';
}

/**
 * The GitHub event that triggered this action
 */
export interface Event {
  pusher?: {
    email?: string;
    name?: string;
  };
}

const genConfig = (input: PushImagesInput): Config => {
  // if (!env.REPO) throw new Error('REPO must be specified');
  // if (!env.BRANCH) throw new Error('BRANCH must be specified');
  // if (!env.FOLDER) throw new Error('FOLDER must be specified');

  const { branch, env } = input;

  // const repo = env.REPO;
  // const branch = env.BRANCH;
  // const sourceDir = env.FOLDER;
  // const skipEmptyCommits = env.SKIP_EMPTY_COMMITS === 'true';
  // const message = env.MESSAGE || DEFAULT_MESSAGE;
  // const tag = env.TAG;

  // Determine the type of URL
  // if (repo === REPO_SELF) {
  if (!input.githubToken) throw new Error('GITHUB_TOKEN must be specified when REPO == self');
  if (!env.GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY must be specified when REPO == self');

  const url = `https://x-access-token:${input.githubToken}@github.com/${env.GITHUB_REPOSITORY}.git`;
  const config: Config = {
    repo: url,
    branch,
    // sourceDir,
    // skipEmptyCommits,
    // mode: 'self',
    // message,
    // tag,
  };

  return config;
  // }
  // const parsedUrl = gitUrlParse(repo);
  //
  // if (parsedUrl.protocol === 'ssh') {
  //   if (!env.SSH_PRIVATE_KEY) throw new Error('SSH_PRIVATE_KEY must be specified when REPO uses ssh');
  //   const config: Config = {
  //     repo,
  //     branch,
  //     sourceDir,
  //     skipEmptyCommits,
  //     mode: 'ssh',
  //     parsedUrl,
  //     privateKey: env.SSH_PRIVATE_KEY,
  //     knownHostsFile: env.KNOWN_HOSTS_FILE,
  //     message,
  //     tag,
  //   };
  //   return config;
  // }
  // throw new Error('Unsupported REPO URL');
};

// const writeToProcess = (
//   command: string,
//   args: string[],
//   opts: {
//     env: { [id: string]: string | undefined };
//     data: string;
//     log: Console;
//   },
// ) =>
//   new Promise<void>((resolve, reject) => {
//     const child = child_process.spawn(command, args, {
//       env: opts.env,
//       stdio: 'pipe',
//     });
//     child.stdin.setDefaultEncoding('utf-8');
//     child.stdin.write(opts.data);
//     child.stdin.end();
//     child.on('error', reject);
//     let stderr = '';
//     child.stdout.on('data', data => {
//       /* istanbul ignore next */
//       opts.log.log(data.toString());
//     });
//     child.stderr.on('data', data => {
//       stderr += data;
//       opts.log.error(data.toString());
//     });
//     child.on('close', code => {
//       /* istanbul ignore else */
//       if (code === 0) {
//         resolve();
//       } else {
//         reject(new Error(stderr));
//       }
//     });
//   });

export const pushImages = async (input: PushImagesInput) => {
  const { env } = input;
  const config = genConfig(input);

  // Calculate paths that use temp diractory

  const TMP_PATH = await fs.mkdtemp(path.join(tmpdir(), 'git-publish-subdir-action-'));
  const REPO_TEMP = path.join(TMP_PATH, 'repo');
  // const SSH_AUTH_SOCK = path.join(TMP_PATH, 'ssh_agent.sock');

  if (!env.GITHUB_EVENT_PATH) throw new Error('Expected GITHUB_EVENT_PATH');

  const event: Event = JSON.parse((await fs.readFile(env.GITHUB_EVENT_PATH)).toString());

  const name = input.commitName ?? event.pusher?.name ?? env.GITHUB_ACTOR ?? 'Git Publish Subdirectory';
  const email =
    input.commitEmail ??
    event.pusher?.email ??
    (env.GITHUB_ACTOR ? `${env.GITHUB_ACTOR}@users.noreply.github.com` : 'nobody@nowhere');
  // const tag = env.TAG;

  // Set Git Config
  await configureName(name);
  await configureEmail(email);

  // interface GitInformation {
  //   commitMessage: string;
  //   sha: string;
  // }

  /**
   * Get information about the current git repository
   */
  // const getGitInformation = async (): Promise<GitInformation> => {
  //   // Get the root git directory
  //   let dir = process.cwd();
  //   while (true) {
  //     const isGitRepo = await fs
  //       .stat(path.join(dir, '.git'))
  //       .then(s => s.isDirectory())
  //       .catch(() => false);
  //     if (isGitRepo) {
  //       break;
  //     }
  //     // We need to traverse up one
  //     const next = path.dirname(dir);
  //     if (next === dir) {
  //       log.log(`[info] Not running in git directory, unable to get information about source commit`);
  //       return {
  //         commitMessage: '',
  //         sha: '',
  //       };
  //     } else {
  //       dir = next;
  //     }
  //   }
  //
  //   // Get current sha of repo to use in commit message
  //   //const gitLog = await git.log({
  //   //  fs: fsModule,
  //   //  depth: 1,
  //   //  dir,
  //   //});
  //   //const commit = gitLog.length > 0 ? gitLog[0] : undefined;
  //   //if (!commit) {
  //   //  log.log(`[info] Unable to get information about HEAD commit`);
  //   //  return {
  //   //    commitMessage: '',
  //   //    sha: '',
  //   //  };
  //   //}
  //   return {
  //     // Use trim to remove the trailing newline
  //     commitMessage: commit.commit.message.trim(),
  //     sha: commit.oid,
  //   };
  // };

  // const gitInfo = await getGitInformation();

  // Environment to pass to children
  const execEnv = env as { [key: string]: string };

  // if (config.mode === 'ssh') {
  //   // Copy over the known_hosts file if set
  //   let known_hosts = config.knownHostsFile;
  //   // Use well-known known_hosts for certain domains
  //   if (!known_hosts && config.parsedUrl.resource === 'github.com') {
  //     known_hosts = KNOWN_HOSTS_GITHUB;
  //   }
  //   if (!known_hosts) {
  //     log.warn(KNOWN_HOSTS_WARNING);
  //   } else {
  //     await mkdirP(SSH_FOLDER);
  //     await fs.copyFile(known_hosts, KNOWN_HOSTS_TARGET);
  //   }
  //
  //   // Setup ssh-agent with private key
  //   log.log(`Setting up ssh-agent on ${SSH_AUTH_SOCK}`);
  //   const sshAgentMatch = SSH_AGENT_PID_EXTRACT.exec(
  //     (await exec(`ssh-agent -a ${SSH_AUTH_SOCK}`, { log, env: execEnv })).stdout,
  //   );
  //   /* istanbul ignore if */
  //   if (!sshAgentMatch) throw new Error('Unexpected output from ssh-agent');
  //   execEnv.SSH_AGENT_PID = sshAgentMatch[1];
  //   log.log(`Adding private key to ssh-agent at ${SSH_AUTH_SOCK}`);
  //   await writeToProcess('ssh-add', ['-'], {
  //     data: config.privateKey + '\n',
  //     env: execEnv,
  //     log,
  //   });
  //   log.log(`Private key added`);
  // }

  // Clone the target repo
  await clone({ repo: config.repo, dist: REPO_TEMP }, { env: execEnv });
  //await exec(`git clone "${config.repo}" "${REPO_TEMP}"`, { log, env: execEnv }).catch(err => {
  // const s = err.toString();
  /* istanbul ignore else */
  // if (config.mode === 'ssh') {
  //   /* istanbul ignore else */
  //   if (s.indexOf('Host key verification failed') !== -1) {
  //     log.error(KNOWN_HOSTS_ERROR(config.parsedUrl.resource));
  //   } else if (s.indexOf('Permission denied (publickey') !== -1) {
  //     log.error(SSH_KEY_ERROR);
  //   }
  // }
  //    throw err;
  //  });

  const execOptions = { env: execEnv, cwd: REPO_TEMP };

  // Fetch branch if it exists
  await fetchOrigin({ branch: config.branch }, execOptions).catch(err => {
    const s = err.toString();
    /* istanbul ignore if */
    if (s.indexOf("Couldn't find remote ref") === -1) {
      log.error("[warning] Failed to fetch target branch, probably doesn't exist");
      log.error(err);
    }
  });

  // Check if branch already exists
  log.info(`Checking if branch ${config.branch} exists already`);
  // const branchCheck = await exec(`git branch --list "${config.branch}"`, {
  //   log,
  //   env: execEnv,
  //   cwd: REPO_TEMP,
  // });

  if (!hasBranch(config.branch, execOptions)) {
    // Branch does not exist yet, let's check it out as an orphan
    log.info(`${config.branch} does not exist, creating as orphan`);
    await checkout(config.branch, true, execOptions);
  } else {
    await checkout(config.branch, false, execOptions);
  }

  // // Update contents of branch
  log.info(`Updating branch ${config.branch}`);

  /**
   * The list of globs we'll use for clearing
   */
  log.info(`Removing all files from target dir ${input.targetDir} on target branch`);
  // const globs = [`${input.targetDir}/**/*`, '!.git'];
  const globs = ['**/*', '!.git'];
  // await (async () => {
  //if (env.CLEAR_GLOBS_FILE) {
  //  // We need to use a custom mechanism to clear the files
  //  log.log(`[info] Using custom glob file to clear target branch ${env.CLEAR_GLOBS_FILE}`);
  //  const globList = (await fs.readFile(env.CLEAR_GLOBS_FILE))
  //    .toString()
  //    .split('\n')
  //    .map(s => s.trim())
  //    .filter(s => s !== '');
  //  return globList;
  // if (input.targetDir) {
  // return [`${input.targetDir}/**/*`, '!.git'];
  // } else {
  //   // Remove all files
  //   log.info(`Removing all files from target branch`);
  //   return ['**/*', '!.git'];
  // }
  // })();

  const filesToDelete = fgStream(globs, { absolute: true, dot: true, followSymbolicLinks: false, cwd: REPO_TEMP });

  // Delete all files from the filestream
  for await (const entry of filesToDelete) {
    await fs.unlink(entry);
  }

  // const sourceDir = path.resolve(process.cwd(), config.sourceDir);
  const destinationFolder = input.targetDir;

  // Make sure the destination sourceDir exists
  await mkdirP(path.resolve(REPO_TEMP, destinationFolder));

  log.info(`Copying all files`);

  // await cp(`${sourceDir}/`, `${REPO_TEMP}/${destinationFolder}/`, {
  //   recursive: true,
  //   copySourceDirectory: false,
  // });

  if (input.result.deletedItems.length > 0) {
    const deletedGlobs =
      input.result.deletedItems.length === 1
        ? `${path.join(workspace(), constants.EXPECTED_DIR_NAME)}/${input.result.deletedItems[0]}`
        : `${path.join(workspace(), constants.EXPECTED_DIR_NAME)}/(${input.result.deletedItems.join('|')})`;
    console.log(deletedGlobs);
    try {
      cpx.copySync(deletedGlobs, `${REPO_TEMP}/${destinationFolder}/deleted/`);
    } catch (e) {
      log.error(`Failed to copy images ${e}`);
    }
  }

  if (input.result.newItems.length > 0) {
    const newGlobs =
      input.result.newItems.length === 1
        ? `${path.join(workspace(), constants.ACTUAL_DIR_NAME)}/${input.result.newItems[0]}`
        : `${path.join(workspace(), constants.ACTUAL_DIR_NAME)}/(${input.result.newItems.join('|')})`;

    console.log(newGlobs);
    try {
      cpx.copySync(newGlobs, `${REPO_TEMP}/${destinationFolder}/new/`);
    } catch (e) {
      log.error(`Failed to copy images ${e}`);
    }
  }

  if (input.result.failedItems.length > 0) {
    const failedGlobs =
      input.result.newItems.length === 1
        ? `${path.join(workspace(), constants.DIFF_DIR_NAME)}/${input.result.failedItems[0]}`
        : `${path.join(workspace(), constants.DIFF_DIR_NAME)}/(${input.result.failedItems.join('|')})`;

    console.log(failedGlobs);
    try {
      cpx.copySync(failedGlobs, `${REPO_TEMP}/${destinationFolder}/diff/`);
    } catch (e) {
      log.error(`Failed to copy images ${e}`);
    }
  }

  // await exec(`git add -A .`, { log, env: execEnv, cwd: REPO_TEMP });

  await add(execOptions);

  const message = `Update ${input.branch} to output generated at runId:${input.runId}`;
  // .replace(/\{target\-branch\}/g, config.branch)
  // .replace(/\{sha\}/g, gitInfo.sha.substr(0, 7))
  // .replace(/\{long\-sha\}/g, gitInfo.sha)
  // .replace(/\{msg\}/g, gitInfo.commitMessage);

  // await git.commit({
  //   fs: fsModule,
  //   dir: REPO_TEMP,
  //   message,
  //   author: { email, name },
  // });

  await commit(message, execOptions);

  // if (tag) {
  //   log.log(`[info] Tagging commit with ${tag}`);
  //   await git.tag({
  //     fs: fsModule,
  //     dir: REPO_TEMP,
  //     ref: tag,
  //     force: true,
  //   });
  // }

  // if (config.skipEmptyCommits) {
  //   log.log(`[info] Checking whether contents have changed before pushing`);
  //   // Before we push, check whether it changed the tree,
  //   // and avoid pushing if not
  //   const head = await git.resolveRef({
  //     fs: fsModule,
  //     dir: REPO_TEMP,
  //     ref: 'HEAD',
  //   });
  //   const currentCommit = await git.readCommit({
  //     fs: fsModule,
  //     dir: REPO_TEMP,
  //     oid: head,
  //   });
  //   if (currentCommit.commit.parent.length === 1) {
  //     const previousCommit = await git.readCommit({
  //       fs: fsModule,
  //       dir: REPO_TEMP,
  //       oid: currentCommit.commit.parent[0],
  //     });
  //     if (currentCommit.commit.tree === previousCommit.commit.tree) {
  //       log.log(`[info] Contents of target repo unchanged, exiting.`);
  //       return;
  //     }
  //   }
  // }

  log.info(`Pushing`);

  // const tagsArg = tag ? '--tags' : '';
  const res = await push(config.branch, execOptions);

  log.info(res.stdout);
  log.info(`Deployment Successful`);

  // if (config.mode === 'ssh') {
  //   log.log(`[info] Killing ssh-agent`);
  //   await exec(`ssh-agent -k`, { log, env: execEnv });
  // }
};
