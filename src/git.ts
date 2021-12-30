import { exec } from '@actions/exec';
import { log } from './logger';

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

const capture = async (cmd: string, args: string[]): Promise<ExecResult> => {
  const res: ExecResult = {
    stdout: '',
    stderr: '',
    code: null,
  };

  try {
    const code = await exec(cmd, args, {
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
  log.debug(`base sha is ${baseSha}, head sha is ${headSha}`);

  await capture('git', ['fetch', '--all']);

  const args = ['merge-base', '-a', `${baseSha}`, `${headSha}`];

  const res = await capture('git', args);

  if (res.code !== 0) {
    throw new Error(`Command 'git ${args.join(' ')}' failed: ${JSON.stringify(res)}`);
  }
  const targetHash = res.stdout;
  return targetHash;
};
