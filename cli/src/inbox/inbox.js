import fs from 'node:fs';

const KEY = /· key ([0-9a-f]{12})\s*$/;
const pad = (n) => String(n).padStart(2, '0');

export const INBOX_HEADER = '# rulebook inbox\n\nDetections awaiting validation. Process them with the rulebook-sync skill.\n\n';

// Keys of every entry, pending or ticked: a ticked entry stands for
// "seen, leave it", so the same detection is not raised again.
export function knownKeys(text) {
  return new Set(
    text.replace(/\r\n?/g, '\n').split('\n')
      .filter((l) => /^- \[[ xX]\]/.test(l))
      .map((l) => l.match(KEY)?.[1])
      .filter(Boolean),
  );
}

export function formatStamp(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatEntry(det, now) {
  const where = det.lines ? `${det.path}:${det.lines[0]}-${det.lines[1]}` : det.path;
  return `- [ ] ${formatStamp(now)} · ${det.type} · ${det.rule ?? '—'} · ${where} · key ${det.key}`;
}

export function formatNotice(det, inboxRel) {
  if (det.type === 'new?') return `rulebook: possible new rule in ${det.path}:${det.lines[0]} → ${inboxRel}`;
  const verb = det.type === 'removed?' ? 'may have been removed' : 'may have changed';
  return `rulebook: ${det.rule} ${verb} (${det.path.split('/').pop()}) → ${inboxRel}`;
}

export function appendDetections(file, detections, now = new Date()) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const seen = knownKeys(existing);
  const added = [];
  for (const d of detections) {
    if (seen.has(d.key)) continue;
    seen.add(d.key);
    added.push(d);
  }
  if (added.length) {
    const prefix = existing ? (existing.endsWith('\n') ? '' : '\n') : INBOX_HEADER;
    fs.appendFileSync(file, `${prefix}${added.map((d) => formatEntry(d, now)).join('\n')}\n`);
  }
  return added;
}
