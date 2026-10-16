import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sync, check } from './sync-references.mjs';

function tree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-refs-'));
  fs.mkdirSync(path.join(root, 'references'));
  fs.writeFileSync(path.join(root, 'references/a.md'), '# A\n');
  fs.mkdirSync(path.join(root, 'skills/x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills/x/SKILL.md'), '---\nname: x\n---\n');
  return root;
}

test('check fails until sync copies the references into every skill', () => {
  const root = tree();
  assert.deepEqual(check(root), ['x']);
  sync(root);
  assert.equal(fs.readFileSync(path.join(root, 'skills/x/references/a.md'), 'utf8'), '# A\n');
  assert.deepEqual(check(root), []);
});

test('an edited or stale copy is reported', () => {
  const root = tree();
  sync(root);
  fs.writeFileSync(path.join(root, 'skills/x/references/a.md'), '# edited\n');
  assert.deepEqual(check(root), ['x']);
  sync(root);
  fs.writeFileSync(path.join(root, 'skills/x/references/stale.md'), 'old');
  assert.deepEqual(check(root), ['x']);
  sync(root);
  assert.equal(fs.existsSync(path.join(root, 'skills/x/references/stale.md')), false);
});
