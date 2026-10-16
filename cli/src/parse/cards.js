import { labelToKey } from './labels.js';

const H1 = /^#\s+([A-Z]{3})\s+[·—–-]\s+(.+?)\s*$/;
const H2_POLICY = /^##\s+([A-Z]{3}-P\d+)\s+[·—–-]\s+(.+?)\s*$/;
const H2_OTHER = /^##\s+\S/;
const H3_RULE = /^###\s+([A-Z]{3}-R\d+)\s+[·—–-]\s+(.+?)\s*$/;
const ANY_HEADING = /^#{1,6}\s/;
const META_LINE = /^-\s+\*\*[^*]+?:\*\*/;
const META_SEGMENT = /^\*\*([^*]+?):\*\*\s*(.*)$/;
// "**Label.** text", also tolerated: "**Label:**", "**Label :**", "**Label**:", "**Label**."
const SECTION = /^\*\*([^*]+?)\s*([.:])?\*\*\s*([.:])?\s*(.*)$/;
const EVIDENCE = /^-\s+(enforcement|test|config|schema|doc)\s+[—–-]\s+(\S+?):(\d+)(?:-(\d+))?(?:\s+`([^`]+)`)?\s*$/;
const EDGE = /^-\s+\*\*([A-Z]{3}-R\d+\.E\d+)\*\*\s+(.+)$/;
const HISTORY = /^-\s+(\d{4}-\d{2}-\d{2})\s+·\s+([0-9a-f]{4,40})\s+·\s+(created|changed|retired|reanchored)(?:\s+·\s+(.*?))?\s*$/;
const CONFIDENCE = ['verified', 'read', 'inferred', 'conflicting'];
const LIST_SECTIONS = new Set(['evidence', 'edgeCases', 'history', 'implementedBy']);

function newCard(id, kind, title, domain, policy, line) {
  return {
    id, kind, title, domain, policy, line,
    meta: { kind: null, category: null, implements: null, status: 'active', confidence: null, audit: null, verifiedAt: null, nature: null },
    sections: {}, evidence: [], edgeCases: [], history: [],
  };
}

function parseMetaValue(key, raw) {
  const value = raw.trim();
  if (key === 'verifiedAt') {
    const m = value.match(/^([0-9a-f]{4,40})(?:\s+\((\d{4}-\d{2}-\d{2})\))?/);
    return m ? { sha: m[1], date: m[2] ?? null } : null;
  }
  if (key === 'implements') return /^[A-Z]{3}-P\d+$/.test(value) ? value : null;
  return value === '' ? null : value;
}

function parseEdge(id, rest) {
  const parts = rest.split(/\s+[—–]\s+/);
  let ref = null;
  let confidence = null;
  if (parts.length > 1 && /^\S+:\d+(-\d+)?$/.test(parts[parts.length - 1].trim())) ref = parts.pop().trim();
  if (parts.length > 1 && CONFIDENCE.includes(parts[parts.length - 1].trim())) confidence = parts.pop().trim();
  // a tail that still looks like a confidence or a reference was not understood
  const malformed = parts.length > 1 && parts.slice(1).some((p) => CONFIDENCE.includes(p.trim()) || /\S+:\d/.test(p));
  return { id, text: parts.join(' — ').trim(), confidence, ref, malformed };
}

export function parseDomainFile(text, file = '') {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const result = { domain: null, cards: [], warnings: [] };
  const warn = (i, message) => result.warnings.push({ file, line: i + 1, message });
  let card = null;
  let policy = null;
  let section = null;

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    let m;
    if ((m = line.match(H1))) {
      result.domain = { code: m[1], title: m[2], description: '' };
      card = null;
      section = 'domain';
      return;
    }
    if ((m = line.match(H2_POLICY))) {
      card = newCard(m[1], 'policy', m[2], result.domain?.code ?? null, null, i + 1);
      policy = m[1];
      result.cards.push(card);
      section = null;
      return;
    }
    if ((m = line.match(H3_RULE))) {
      card = newCard(m[1], 'rule', m[2], result.domain?.code ?? null, policy, i + 1);
      result.cards.push(card);
      section = null;
      return;
    }
    if (H2_OTHER.test(line)) {
      card = null;
      policy = null;
      section = null;
      return;
    }
    if (ANY_HEADING.test(line)) {
      warn(i, `unrecognised heading "${trimmed}"`);
      card = null;
      section = null;
      return;
    }
    if (!card) {
      if (section === 'domain' && trimmed) {
        result.domain.description += (result.domain.description ? ' ' : '') + trimmed;
      }
      return;
    }
    if (trimmed === '') {
      if (section && !LIST_SECTIONS.has(section)) section = null;
      return;
    }
    if (section === null && META_LINE.test(trimmed)) {
      for (const seg of trimmed.replace(/^-\s+/, '').split(/\s+·\s+/)) {
        const sm = seg.match(META_SEGMENT);
        if (!sm) { warn(i, `unreadable metadata "${seg}"`); continue; }
        const key = labelToKey(sm[1]);
        if (!key || !(key in card.meta)) { warn(i, `unknown metadata label "${sm[1].trim()}"`); continue; }
        card.meta[key] = parseMetaValue(key, sm[2]);
      }
      return;
    }
    if ((m = trimmed.match(SECTION)) && (m[2] || m[3])) {
      const key = labelToKey(m[1]);
      if (!key) { warn(i, `unknown section "${m[1]}"`); section = '__unknown'; return; }
      section = key;
      if (!LIST_SECTIONS.has(key)) card.sections[key] = m[4].trim();
      return;
    }
    if (section === 'evidence') {
      if ((m = trimmed.match(EVIDENCE))) {
        card.evidence.push({ kind: m[1], path: m[2].replace(/\\/g, '/'), start: +m[3], end: m[4] ? +m[4] : +m[3], symbol: m[5] ?? null });
      } else if (trimmed.startsWith('-')) {
        warn(i, `unreadable evidence "${trimmed}"`);
      }
      return;
    }
    if (section === 'edgeCases') {
      if ((m = trimmed.match(EDGE))) {
        const { malformed, ...edge } = parseEdge(m[1], m[2]);
        if (malformed) warn(i, `edge case ${edge.id}: unreadable confidence or reference (use "— <confidence> — <path>:<line>")`);
        card.edgeCases.push(edge);
      }
      else if (trimmed.startsWith('-')) warn(i, `unreadable edge case "${trimmed}"`);
      return;
    }
    if (section === 'history') {
      if ((m = trimmed.match(HISTORY))) card.history.push({ date: m[1], sha: m[2], change: m[3], note: m[4] ?? null });
      else if (trimmed.startsWith('-')) warn(i, `unreadable history entry "${trimmed}"`);
      return;
    }
    if (section && section !== '__unknown' && section !== 'implementedBy') {
      card.sections[section] += (card.sections[section] ? ' ' : '') + trimmed;
    }
  });
  return result;
}
