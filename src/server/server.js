// Elite Dangerous companion — local server.
// Indexes the full journal history on start, then tails the live journal and
// pushes derived commander state to the browser over Server-Sent Events.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { GameState } from './gameState.js';
import { listJournals, parseJournalFile, parseLines, readAuxJson, mtimeOf } from './journalFiles.js';
import {
  loadConfig, saveConfig, loadProgress, saveProgress,
  REF_DIR, USER_DIR, WEB_DIR, ensureDir,
} from './config.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const REF_FILES = ['engineers', 'permits', 'systems', 'ranks', 'milestones', 'core-checklists', 'racetracks'];

let config = loadConfig();
let state = new GameState();
let meta = { journalDir: config.journalDir, journalCount: 0, indexed: false, dirExists: false };

// Live-tail bookkeeping.
const tail = { path: null, offset: 0, carry: '' };
const aux = { statusMtime: 0, navRouteMtime: 0 };

const sseClients = new Set();

// ---------------------------------------------------------------------------
// Indexing + watching
// ---------------------------------------------------------------------------
function rebuild() {
  config = loadConfig();
  state = new GameState();
  meta = { journalDir: config.journalDir, journalCount: 0, indexed: false, dirExists: false };

  const dir = config.journalDir;
  meta.dirExists = fs.existsSync(dir);
  const journals = listJournals(dir);
  meta.journalCount = journals.length;

  for (const j of journals) {
    const events = parseJournalFile(j.path);
    for (const e of events) state.apply(e);
  }

  // Seed live status files.
  const status = readAuxJson(dir, 'Status.json');
  if (status) state.applyStatus(status);
  const navRoute = readAuxJson(dir, 'NavRoute.json');
  if (navRoute) state.setRoute(navRoute);

  // Prime the tailer at the end of the newest journal so we only emit new lines.
  const active = journals[journals.length - 1];
  tail.path = active ? active.path : null;
  tail.offset = active ? active.size : 0;
  tail.carry = '';
  aux.statusMtime = mtimeOf(path.join(dir, 'Status.json'));
  aux.navRouteMtime = mtimeOf(path.join(dir, 'NavRoute.json'));

  meta.indexed = true;
  console.log(`[ed] Indexed ${journals.length} journals from ${dir}`);
  console.log(`[ed] Commander: ${state.commander.name || '(unknown)'} · Balance: ${fmt(state.balance)} CR · Visited systems: ${state.visited.size}`);
}

function readAppended(filePath, offset) {
  let fd;
  try {
    const st = fs.statSync(filePath);
    if (st.size < offset) offset = 0;               // rotated/truncated
    if (st.size === offset) return { text: '', offset };
    fd = fs.openSync(filePath, 'r');
    const len = st.size - offset;
    const buf = Buffer.allocUnsafe(len);
    fs.readSync(fd, buf, 0, len, offset);
    return { text: buf.toString('utf8'), offset: st.size };
  } catch {
    return { text: '', offset };
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* ignore */ } }
  }
}

function tick() {
  if (!meta.indexed) return;
  const dir = config.journalDir;
  let dirty = false;

  // Switch to a newer journal file if the game rolled over / started a new session.
  const journals = listJournals(dir);
  if (journals.length) {
    const newest = journals[journals.length - 1];
    if (newest.path !== tail.path) {
      tail.path = newest.path;
      tail.offset = 0;
      tail.carry = '';
    }
    meta.journalCount = journals.length;
  }

  // Tail the active journal.
  if (tail.path) {
    const { text, offset } = readAppended(tail.path, tail.offset);
    tail.offset = offset;
    if (text) {
      tail.carry += text;
      const nl = tail.carry.lastIndexOf('\n');
      if (nl !== -1) {
        const complete = tail.carry.slice(0, nl);
        tail.carry = tail.carry.slice(nl + 1);
        const events = parseLines(complete);
        for (const e of events) state.apply(e);
        if (events.length) dirty = true;
      }
    }
  }

  // Status.json (live balance + flags) updates many times/sec — check mtime.
  const statusPath = path.join(dir, 'Status.json');
  const sm = mtimeOf(statusPath);
  if (sm && sm !== aux.statusMtime) {
    aux.statusMtime = sm;
    const status = readAuxJson(dir, 'Status.json');
    if (status) { state.applyStatus(status); dirty = true; }
  }

  // NavRoute.json (plotted route).
  const navPath = path.join(dir, 'NavRoute.json');
  const nm = mtimeOf(navPath);
  if (nm && nm !== aux.navRouteMtime) {
    aux.navRouteMtime = nm;
    const navRoute = readAuxJson(dir, 'NavRoute.json');
    state.setRoute(navRoute);
    dirty = true;
  }

  if (dirty) broadcast();
}

// ---------------------------------------------------------------------------
// SSE
// ---------------------------------------------------------------------------
function broadcast() {
  const payload = `data: ${JSON.stringify({ type: 'state', state: state.snapshot(), meta })}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { /* client gone */ }
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
function sendJson(res, obj, code = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function serveStatic(res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  rel = decodeURIComponent(rel.split('?')[0]);
  const full = path.normalize(path.join(WEB_DIR, rel));
  if (!full.startsWith(WEB_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // --- API ---
  if (url === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'state', state: state.snapshot(), meta })}\n\n`);
    sseClients.add(res);
    const hb = setInterval(() => { try { res.write(':\n\n'); } catch { /* ignore */ } }, 25000);
    req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
    return;
  }

  if (url === '/api/state') { sendJson(res, { state: state.snapshot(), meta }); return; }

  if (url === '/api/reference-all') {
    const out = {};
    for (const name of REF_FILES) {
      try { out[name] = JSON.parse(fs.readFileSync(path.join(REF_DIR, `${name}.json`), 'utf8')); }
      catch { out[name] = null; }
    }
    sendJson(res, out);
    return;
  }

  if (url.startsWith('/api/reference/')) {
    const name = url.slice('/api/reference/'.length).replace(/\.json$/, '');
    if (!REF_FILES.includes(name)) { res.writeHead(404); res.end('Unknown reference'); return; }
    serveStaticFile(res, path.join(REF_DIR, `${name}.json`));
    return;
  }

  if (url === '/api/progress') {
    if (req.method === 'POST') {
      const body = await readBody(req);
      const progress = loadProgress();
      progress.manual = progress.manual || {};
      progress.notes = progress.notes || {};
      if (body.id != null && 'checked' in body) progress.manual[body.id] = !!body.checked;
      if (body.id != null && 'note' in body) progress.notes[body.id] = String(body.note || '');
      saveProgress(progress);
      sendJson(res, { ok: true, progress });
    } else {
      sendJson(res, loadProgress());
    }
    return;
  }

  if (url === '/api/config') {
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.journalDir) config.journalDir = String(body.journalDir);
      saveConfig(config);
      rebuild();
      broadcast();
      sendJson(res, { ok: true, config, meta });
    } else {
      sendJson(res, { config, meta });
    }
    return;
  }

  // --- static ---
  serveStatic(res, url);
});

function serveStaticFile(res, full) {
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function fmt(n) { return (n || 0).toLocaleString('en-US'); }

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
ensureDir(USER_DIR);
rebuild();
setInterval(tick, 800);

const port = config.port || 8787;
server.listen(port, () => {
  console.log(`\n  ┌─ ED COMPANION ─────────────────────────────`);
  console.log(`  │  Open  http://localhost:${port}`);
  console.log(`  │  CMDR  ${state.commander.name || '(no journal found)'}`);
  console.log(`  └────────────────────────────────────────────\n`);
});
