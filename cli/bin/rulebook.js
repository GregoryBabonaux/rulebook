#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { run } from '../src/cli.js';

function readStdin() {
  if (process.argv[2] !== 'hook' || process.stdin.isTTY) return '';
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  stdin: readStdin(),
});
