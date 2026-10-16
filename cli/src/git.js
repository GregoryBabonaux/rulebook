import { execFileSync } from 'node:child_process';

export function git(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

export function repoRoot(cwd) {
  return git(cwd, ['rev-parse', '--show-toplevel'])?.trim() || null;
}

export function headSha(root) {
  return git(root, ['rev-parse', '--short', 'HEAD'])?.trim() || null;
}
