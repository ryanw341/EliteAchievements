// Builds a self-contained Windows release: the app + a bundled Node runtime,
// so end users can download, unzip, and double-click — no Node install needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const APP = path.join(DIST, 'EliteAchievements');

console.log('Cleaning dist/ ...');
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(APP, 'runtime'), { recursive: true });

console.log('Copying application files ...');
fs.cpSync(path.join(ROOT, 'src'), path.join(APP, 'src'), { recursive: true });
fs.cpSync(path.join(ROOT, 'data', 'reference'), path.join(APP, 'data', 'reference'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(APP, 'package.json'));
if (fs.existsSync(path.join(ROOT, 'README.md'))) {
  fs.copyFileSync(path.join(ROOT, 'README.md'), path.join(APP, 'README.md'));
}

console.log(`Bundling Node runtime (${process.version}) ...`);
fs.copyFileSync(process.execPath, path.join(APP, 'runtime', 'node.exe'));

console.log('Writing launcher + notes ...');
const launcher = [
  '@echo off',
  'setlocal',
  'title EliteAchievements',
  'cd /d "%~dp0"',
  '',
  'echo.',
  'echo   ELITE ACHIEVEMENTS is starting...',
  'echo   A browser tab will open at http://localhost:8787 once it is ready',
  'echo   (first launch scans your Elite Dangerous journals).',
  'echo.',
  'echo   Keep this window open while you play. Close it to stop.',
  'echo.',
  '',
  'rem Open the browser once the server is listening.',
  String.raw`start "" powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 60;$i++){ try{ $null = Invoke-WebRequest -UseBasicParsing http://localhost:8787 -TimeoutSec 1; Start-Process ''http://localhost:8787''; break } catch { Start-Sleep -Seconds 1 } }"`,
  '',
  '"%~dp0runtime\\node.exe" "%~dp0src\\server\\server.js"',
  '',
].join('\r\n');
fs.writeFileSync(path.join(APP, 'EliteAchievements.bat'), launcher);

const readme = [
  'ELITE ACHIEVEMENTS — quick start',
  '==========================',
  '',
  '1. Double-click "EliteAchievements.bat".',
  '2. A browser tab opens automatically at http://localhost:8787.',
  '3. Leave the black window open while you play; close it to stop.',
  '',
  'No installation needed — the Node runtime is bundled in the runtime\\ folder.',
  'Your checklist ticks and settings are saved in data\\user\\.',
  '',
  'If Windows SmartScreen warns about the .bat, choose "More info" -> "Run anyway"',
  '(it just launches the bundled runtime locally; nothing is sent anywhere).',
  '',
].join('\r\n');
fs.writeFileSync(path.join(APP, 'READ ME FIRST.txt'), readme);

console.log('Zipping release ...');
const zip = path.join(DIST, 'EliteAchievements-win-x64.zip');
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${APP}' -DestinationPath '${zip}' -Force"`,
  { stdio: 'inherit' },
);

const sizeMB = (fs.statSync(zip).size / 1e6).toFixed(1);
console.log(`\nDone -> ${zip} (${sizeMB} MB)`);
console.log('Attach this ZIP to a GitHub Release. Users unzip and run "EliteAchievements.bat".');
