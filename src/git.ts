import { ExecOptions, exec } from '@actions/exec';
import { log } from './logger';

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

const capture = async (cmd: string, args: string[], options: ExecOptions = {}): Promise<ExecResult> => {
  const res: ExecResult = {
    stdout: '',
    stderr: '',
    code: null,
  };

  try {
    const code = await exec(cmd, args, {
      ...options,
      listeners: {
        stdout(data) {
          res.stdout += data.toString();
        },
        stderr(data) {
          res.stderr += data.toString();
        },
      },
    });
    res.code = code;
    return res;
  } catch (err) {
    const msg = `Command '${cmd}' failed with args '${args.join(' ')}': ${res.stderr}: ${err}`;
    log.debug(`@actions/exec.exec() threw an error: ${msg}`);
    throw new Error(msg);
  }
};

export const findTargetHash = async (baseSha: string, headSha: string): Promise<string> => {
  log.info(`base sha is ${baseSha}, head sha is ${headSha}`);

  await capture('git', ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*']);

  await capture('git', ['fetch', '--all']);

  const args = ['merge-base', '-a', `${baseSha}`, `${headSha}`];

  const res = await capture('git', args);

  if (res.code !== 0) {
    throw new Error(`Command 'git ${args.join(' ')}' failed: ${JSON.stringify(res)}`);
  }
  const targetHash = res.stdout;
  return targetHash;
};

export const configureName = async (name: string): Promise<void> => {
  await capture('git', ['config', '--global', 'user.name', name]);
};

export const configureEmail = async (email: string): Promise<void> => {
  await capture('git', ['config', '--global', 'user.email', email]);
};

export const clone = async (input: { repo: string; dist: string }, options: ExecOptions = {}): Promise<ExecResult> => {
  return capture('git', ['clone', input.repo, input.dist], options);
};

export const fetchOrigin = async (input: { branch: string }, options: ExecOptions = {}): Promise<ExecResult> => {
  return capture('git', ['fetch', '-u', 'origin', `${input.branch}:${input.branch}`], options);
};

export const hasBranch = async (branch: string, options: ExecOptions = {}): Promise<boolean> => {
  const res = await capture('git', ['branch', '--list', branch], options);
  return res.stdout.trim() !== '';
};

export const checkout = async (branch: string, orphan: boolean, options: ExecOptions = {}): Promise<ExecResult> => {
  const args = orphan ? ['checkout', '--orphan', branch] : ['checkout', branch];
  return capture('git', args, options);
};

export const add = async (options: ExecOptions = {}): Promise<ExecResult> => {
  return capture('git', ['add', '-A', '.'], options);
};

export const commit = async (message: string, options: ExecOptions = {}): Promise<ExecResult> => {
  return capture('git', ['commit', '-m', message], options);
};

export const push = async (branch: string, options: ExecOptions = {}): Promise<ExecResult> => {
  return capture('git', ['push', 'origin', branch], options);
};

export const rebase = async (branch: string, options: ExecOptions = {}): Promise<ExecResult> => {
  return capture('git', ['rebase', `origin/${branch}`], options);
};
