import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org/rulebook-cli/latest';
const DAY = 24 * 3600 * 1000;

export function cacheFile(env) {
  let base = env.RULEBOOK_CACHE_DIR;
  if (!base && process.platform === 'win32' && env.LOCALAPPDATA) base = path.join(env.LOCALAPPDATA, 'rulebook');
  if (!base) base = path.join(env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'rulebook');
  return path.join(base, 'update.json');
}

export function readCache(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export function writeCache(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  } catch { /* the cache is best effort */ }
}

export function isNewer(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

function spawnWorker(file, url) {
  try {
    const worker = fileURLToPath(new URL('./worker.js', import.meta.url));
    spawn(process.execPath, [worker, file, url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch { /* best effort */ }
}

// Never touches the network itself: a stale cache starts a detached worker,
// and a newer version already in the cache is announced once per day.
export function updateNotice({ env, now, current, spawnCheck = spawnWorker }) {
  if (!env || env.RULEBOOK_NO_UPDATE_CHECK || env.CI) return null;
  const file = cacheFile(env);
  const cache = readCache(file);
  const t = now.getTime();
  const fresh = Number.isFinite(cache.checkedAt) && cache.checkedAt <= t && t - cache.checkedAt <= DAY;
  if (!fresh) {
    cache.checkedAt = t;
    writeCache(file, cache);
    spawnCheck(file, env.RULEBOOK_REGISTRY_URL || DEFAULT_REGISTRY);
  }
  const today = now.toISOString().slice(0, 10);
  if (typeof cache.latest === 'string' && isNewer(cache.latest, current) && cache.notifiedOn !== today) {
    cache.notifiedOn = today;
    writeCache(file, cache);
    return `rulebook ${cache.latest} available — npx rulebook-cli@latest update`;
  }
  return null;
}
