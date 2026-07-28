// Locating and reading Elite Dangerous journal + status files.
import fs from 'node:fs';
import path from 'node:path';

const JOURNAL_RE = /^Journal\..*\.log$/i;

/** List journal files in a directory, sorted oldest -> newest by mtime. */
export function listJournals(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const files = names
    .filter((n) => JOURNAL_RE.test(n))
    .map((n) => {
      const full = path.join(dir, n);
      let mtime = 0;
      let size = 0;
      try {
        const st = fs.statSync(full);
        mtime = st.mtimeMs;
        size = st.size;
      } catch { /* ignore */ }
      return { name: n, path: full, mtime, size };
    });
  files.sort((a, b) => a.mtime - b.mtime || a.name.localeCompare(b.name));
  return files;
}

/** Parse a full journal file into an array of event objects (bad lines skipped). */
export function parseJournalFile(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  return parseLines(text);
}

/** Parse newline-delimited JSON text into event objects. */
export function parseLines(text) {
  const events = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch { /* mid-write / malformed line — skip */ }
  }
  return events;
}

/** Safely read and parse one of the auxiliary status JSON files. Returns null if absent/invalid. */
export function readAuxJson(dir, fileName) {
  try {
    const full = path.join(dir, fileName);
    const text = fs.readFileSync(full, 'utf8');
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** mtimeMs of a file, or 0 if missing. */
export function mtimeOf(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}
