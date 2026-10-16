import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './git.js';

export const SUPPORTED_FORMAT = 1;

export const DEFAULT_CONFIG = { language: 'en', repoUrl: null, hotspots: [] };

export function loadProject(cwd, dirName = 'rulebook') {
  const root = repoRoot(cwd);
  if (!root) return null;
  const dir = path.join(root, dirName);
  if (!fs.existsSync(dir)) return null;
  const cfgPath = path.join(dir, 'config.json');
  let config = { ...DEFAULT_CONFIG };
  if (fs.existsSync(cfgPath)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) };
    } catch (err) {
      throw new Error(`invalid ${dirName}/config.json (${err.message})`);
    }
  }
  return { root, dir, dirName, config };
}

export function domainFiles(dir) {
  return fs.readdirSync(dir).filter((f) => /^[A-Z]{3}-.+\.md$/.test(f)).sort();
}
