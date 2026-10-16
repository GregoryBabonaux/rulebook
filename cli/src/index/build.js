import fs from 'node:fs';
import path from 'node:path';
import { parseDomainFile } from '../parse/cards.js';
import { domainFiles } from '../project.js';
import { splitLines, fingerprint } from './hash.js';

export function loadCards(project) {
  const cards = [];
  const warnings = [];
  for (const f of domainFiles(project.dir)) {
    const parsed = parseDomainFile(fs.readFileSync(path.join(project.dir, f), 'utf8'), `${project.dirName}/${f}`);
    cards.push(...parsed.cards);
    warnings.push(...parsed.warnings);
  }
  return { cards, warnings };
}

export function buildIndex(root, cards, verifiedAt) {
  const anchors = [];
  const unresolved = [];
  for (const card of cards) {
    if (card.kind !== 'rule' || card.meta.status === 'retired') continue;
    for (const ev of card.evidence) {
      const abs = path.join(root, ev.path);
      if (!fs.existsSync(abs)) {
        unresolved.push({ rule: card.id, path: ev.path, reason: 'file not found' });
        continue;
      }
      if (!fs.statSync(abs).isFile()) {
        unresolved.push({ rule: card.id, path: ev.path, reason: 'not a file' });
        continue;
      }
      const lines = splitLines(fs.readFileSync(abs, 'utf8'));
      if (ev.start < 1 || ev.end < ev.start || ev.end > lines.length) {
        unresolved.push({ rule: card.id, path: ev.path, reason: `lines ${ev.start}-${ev.end} out of range (file has ${lines.length})` });
        continue;
      }
      anchors.push({ rule: card.id, kind: ev.kind, path: ev.path, symbol: ev.symbol, lines: [ev.start, ev.end], ...fingerprint(lines, ev.start, ev.end) });
    }
  }
  return { index: { version: 1, verifiedAt, anchors }, unresolved };
}

export function readIndex(dir) {
  const p = path.join(dir, '.index.json');
  if (!fs.existsSync(p)) return { version: 1, verifiedAt: null, anchors: [] };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeIndex(dir, index) {
  fs.writeFileSync(path.join(dir, '.index.json'), `${JSON.stringify(index, null, 2)}\n`);
}
