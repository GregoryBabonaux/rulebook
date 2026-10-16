const LINE = /^-\s+\*\*([A-Z]{3})\*\*\s+[·—–-]\s+(.+?)(?:\s+[—–]\s+(.*?))?\s*$/;
// indented under a domain line: "  - **Label** : text" (colon inside or outside the bold)
const DETAIL = /^\s+-\s+\*\*([^*]+?)\s*:?\*\*\s*:?\s*(.*?)\s*$/;

export function parseIndexMd(text) {
  const domains = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const m = line.match(LINE);
    if (m) { domains.push({ code: m[1], title: m[2], description: m[3] ?? '', details: [] }); continue; }
    const d = line.match(DETAIL);
    if (d && domains.length) domains.at(-1).details.push({ label: d[1], text: d[2] });
  }
  return domains;
}
