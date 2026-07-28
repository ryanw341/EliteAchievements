// Configuration, paths, and small JSON persistence helpers.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..', '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const REF_DIR = path.join(DATA_DIR, 'reference');
// User data (config + progress) can be redirected to a writable location — e.g. the
// desktop app points this at the OS userData folder so installed copies stay writable.
export const USER_DIR = process.env.ED_COMPANION_USER_DIR || path.join(DATA_DIR, 'user');
export const WEB_DIR = path.join(ROOT, 'src', 'web');

const CONFIG_PATH = path.join(USER_DIR, 'config.json');
const PROGRESS_PATH = path.join(USER_DIR, 'progress.json');

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Default Elite Dangerous journal folder on this platform. */
export function defaultJournalDir() {
  // Windows "Saved Games" is under the user profile.
  return path.join(os.homedir(), 'Saved Games', 'Frontier Developments', 'Elite Dangerous');
}

export function loadConfig() {
  const envPort = Number(process.env.ED_COMPANION_PORT) || 0;
  const defaults = { journalDir: defaultJournalDir(), port: envPort || 8787 };
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const merged = { ...defaults, ...raw };
    if (envPort) merged.port = envPort;      // env wins for the desktop app
    return merged;
  } catch {
    return defaults;
  }
}

export function saveConfig(cfg) {
  ensureDir(USER_DIR);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
  } catch {
    return { manual: {}, notes: {} };
  }
}

export function saveProgress(progress) {
  ensureDir(USER_DIR);
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}
