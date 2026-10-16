#!/usr/bin/env node
import { run } from '../src/cli.js';

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
});
