import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendDetections, knownKeys, formatEntry, formatNotice } from '../../src/inbox/inbox.js';

const now = new Date(2026, 9, 15, 14, 2);
const mod = { type: 'modified?', rule: 'PAY-R012', path: 'app/Policies/OrderPolicy.php', lines: [41, 47], key: 'aaaaaaaaaaaa' };
const neu = { type: 'new?', rule: null, path: 'app/Services/Coupon.php', lines: [3, 3], key: 'bbbbbbbbbbbb' };

test('entry and notice formats', () => {
  assert.equal(formatEntry(mod, now), '- [ ] 2026-10-15 14:02 · modified? · PAY-R012 · app/Policies/OrderPolicy.php:41-47 · key aaaaaaaaaaaa');
  assert.equal(formatEntry(neu, now), '- [ ] 2026-10-15 14:02 · new? · — · app/Services/Coupon.php:3-3 · key bbbbbbbbbbbb');
  assert.equal(formatNotice(mod, 'rulebook/inbox.md'), 'rulebook: PAY-R012 may have changed (OrderPolicy.php) → rulebook/inbox.md');
  assert.equal(formatNotice({ ...mod, type: 'removed?' }, 'rulebook/inbox.md'), 'rulebook: PAY-R012 may have been removed (OrderPolicy.php) → rulebook/inbox.md');
  assert.equal(formatNotice(neu, 'rulebook/inbox.md'), 'rulebook: possible new rule in app/Services/Coupon.php:3 → rulebook/inbox.md');
});

test('appendDetections creates the inbox with a header and dedups pending keys', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-inbox-')), 'inbox.md');
  assert.equal(appendDetections(file, [mod, neu, mod], now).length, 2);
  assert.equal(appendDetections(file, [mod], now).length, 0);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^# rulebook inbox\n/);
  assert.equal(text.match(/^- \[ \]/gm).length, 2);
});

test('a ticked entry is remembered: the same key is not added again', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-inbox-')), 'inbox.md');
  appendDetections(file, [mod], now);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- [ ]', '- [x]'));
  assert.deepEqual([...knownKeys(fs.readFileSync(file, 'utf8'))], ['aaaaaaaaaaaa']);
  assert.equal(appendDetections(file, [mod], now).length, 0);
});
