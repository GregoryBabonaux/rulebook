import { readCache, writeCache } from './notice.js';

const [file, url] = process.argv.slice(2);
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
  const body = await res.json();
  if (typeof body?.version === 'string') writeCache(file, { ...readCache(file), checkedAt: Date.now(), latest: body.version });
} catch { /* offline or registry down: try again tomorrow */ }
