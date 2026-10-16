import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const expected = JSON.parse(fs.readFileSync(path.join(here, 'shop/expected.json'), 'utf8'));

function scanGolden() {
  const ws = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-scan-')), 'shop');
  execFileSync(process.execPath, [path.join(here, 'workspace.mjs'), ws, '--golden'], { stdio: 'ignore' });
  execFileSync(process.execPath, [path.join(here, '../../cli/bin/rulebook.js'), 'scan'], { cwd: ws, stdio: 'ignore' });
  return JSON.parse(fs.readFileSync(path.join(ws, 'rulebook/.scan.json'), 'utf8'));
}

test('the scan finds a decision point inside every expected rule of the shop', () => {
  const scan = scanGolden();
  const missed = expected.rules.filter((r) => !r.anchors.some((a) => scan.points.some((p) => p.path === a.file && p.line >= a.lines[0] && p.line <= a.lines[1])));
  assert.deepEqual(missed.map((r) => r.key), []);
});

test('the golden rulebook accounts for every decision point: a card or a line in not-rules.md', () => {
  const scan = scanGolden();
  assert.deepEqual(scan.points.filter((p) => p.status === 'review').map((p) => `${p.path}:${p.line}`), []);
  assert.equal(scan.outside, 0);
});
