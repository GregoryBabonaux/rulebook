const LINE = /^-\s+\*\*([A-Z]{3})\*\*\s+[·—–-]\s+(.+?)(?:\s+[—–]\s+(.*?))?\s*$/;

export function parseIndexMd(text) {
  return text.replace(/\r\n?/g, '\n').split('\n').flatMap((line) => {
    const m = line.trim().match(LINE);
    return m ? [{ code: m[1], title: m[2], description: m[3] ?? '' }] : [];
  });
}
