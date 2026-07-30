// Demo mode: regenerate the fake journal, then run the app against it in
// isolation (its own journal + user folders) — never touches your real save.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate } from './make-demo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const result = generate();
process.env.ED_COMPANION_JOURNAL_DIR = path.join(ROOT, 'demo', 'journal');
process.env.ED_COMPANION_USER_DIR = path.join(ROOT, 'demo', 'user');
process.env.ED_COMPANION_PORT = process.env.ED_COMPANION_PORT || '8799'; // own port, won't clash with a live instance

console.log(`[demo] fake journal ready (${result.events} events, ${result.visited} systems). CMDR REDACTED.`);
await import(pathToFileURL(path.join(ROOT, 'src', 'server', 'server.js')).href);
