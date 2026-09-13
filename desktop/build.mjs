/**
 * Build the office installer: desktop/dist/LiturgyGen-Setup-<version>.exe
 *
 *   npm run package:desktop
 *
 * The installer carries everything the office computer needs - its own Node,
 * the server and its dependencies, the built screens, the launcher - plus a
 * starting copy of this computer's data: the prayers, corrections, schedule,
 * settings and saved readings. A computer installing for the first time starts
 * from that copy; one that already has LiturgyGen keeps its own data.
 *
 * Needs, on the computer that builds (not the office's): Windows, and Inno
 * Setup 6 (`winget install JRSoftware.InnoSetup`). The launcher is compiled by
 * the C# compiler that ships with Windows.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const DIST = path.join(HERE, 'dist');
const STAGE = path.join(DIST, 'stage');
const APP = path.join(STAGE, 'app');
const DATA = path.join(STAGE, 'data');

const version = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
const isWindows = process.platform === 'win32';

const step = (message) => console.log(`\n== ${message}`);
const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: 'inherit', shell: isWindows && !path.isAbsolute(command), ...options });
const copy = (from, to, filter) => fs.cpSync(from, to, { recursive: true, filter });

function findFirst(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

if (!isWindows) {
  console.error('The installer is built on Windows: it bundles the Windows Node and compiles a Windows launcher.');
  process.exit(1);
}

const iscc = findFirst([
  process.env.ISCC,
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
]);
if (!iscc) {
  console.error('Inno Setup 6 was not found. Install it with:  winget install JRSoftware.InnoSetup');
  process.exit(1);
}
const csc = findFirst([
  path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
  path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
]);
if (!csc) {
  console.error('The Windows C# compiler (.NET Framework 4) was not found.');
  process.exit(1);
}

step('Clearing the previous build');
fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(APP, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

step('Building the screens');
run('npm', ['run', 'build'], { cwd: REPO });
copy(path.join(REPO, 'client', 'dist'), path.join(APP, 'client', 'dist'));

step('Copying the server');
copy(path.join(REPO, 'server', 'src'), path.join(APP, 'server', 'src'));

// Pin every dependency to the exact version tested here. The romcal packages
// are prereleases, where a caret range could quietly pull a different calendar.
const serverPackage = JSON.parse(fs.readFileSync(path.join(REPO, 'server', 'package.json'), 'utf8'));
for (const name of Object.keys(serverPackage.dependencies)) {
  const installed = findFirst([
    path.join(REPO, 'server', 'node_modules', name, 'package.json'),
    path.join(REPO, 'node_modules', name, 'package.json'),
  ]);
  if (!installed) throw new Error(`${name} is not installed; run npm install first.`);
  serverPackage.dependencies[name] = JSON.parse(fs.readFileSync(installed, 'utf8')).version;
}
delete serverPackage.scripts.dev;
fs.writeFileSync(path.join(APP, 'server', 'package.json'), `${JSON.stringify(serverPackage, null, 2)}\n`);

// Installed outside the repository so npm does not treat it as part of the
// workspace. The same Node that installs is the Node that ships, so the
// database driver's compiled part always matches it.
step('Installing the server dependencies');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'liturgygen-build-'));
try {
  fs.copyFileSync(path.join(APP, 'server', 'package.json'), path.join(scratch, 'package.json'));
  run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--no-package-lock'], { cwd: scratch });
  copy(path.join(scratch, 'node_modules'), path.join(APP, 'server', 'node_modules'));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

step(`Bundling Node ${process.version}`);
fs.mkdirSync(path.join(APP, 'node'), { recursive: true });
fs.copyFileSync(process.execPath, path.join(APP, 'node', 'node.exe'));

step('Copying the prayer books');
// The office's transcriptions: the seeder refreshes unedited prayers from these
// on every start. Only the books themselves - not worksheets or backups.
const orillo = path.join(REPO, 'server', 'data', 'orillo');
if (fs.existsSync(orillo)) {
  fs.mkdirSync(path.join(APP, 'server', 'data', 'orillo'), { recursive: true });
  for (const file of fs.readdirSync(orillo)) {
    if (file.endsWith('.json') && !file.startsWith('_')) {
      fs.copyFileSync(path.join(orillo, file), path.join(APP, 'server', 'data', 'orillo', file));
    }
  }
} else {
  console.warn('   server/data/orillo is missing: new installs will start with placeholder prayers only.');
}

step('Taking a starting copy of the data');
const database = path.join(REPO, 'server', 'data', 'liturgygen.sqlite');
if (fs.existsSync(database)) {
  // SQLite's own backup, so a running app's unwritten changes are included and
  // the copy is one consistent file.
  const source = new Database(database, { readonly: true, fileMustExist: true });
  await source.backup(path.join(DATA, 'liturgygen.sqlite'));
  source.close();
} else {
  console.warn('   No database here: new installs will create an empty one.');
}
const cache = path.join(REPO, 'server', '.cache');
for (const folder of ['readings', 'usccb']) {
  if (fs.existsSync(path.join(cache, folder))) copy(path.join(cache, folder), path.join(DATA, 'cache', folder));
}

step('Compiling the launcher');
run(csc, [
  '/nologo',
  '/target:winexe',
  '/optimize+',
  `/win32icon:${path.join(HERE, 'LiturgyGen.ico')}`,
  `/out:${path.join(APP, 'LiturgyGen.exe')}`,
  '/r:System.Windows.Forms.dll',
  '/r:System.Drawing.dll',
  path.join(HERE, 'launcher', 'LiturgyGen.cs'),
]);

step('Building the installer');
run(iscc, [
  '/Q',
  `/DStage=${STAGE}`,
  `/DOutputDir=${DIST}`,
  `/DAppVersion=${version}`,
  path.join(HERE, 'LiturgyGen.iss'),
]);

console.log(`\nDone: ${path.join(DIST, `LiturgyGen-Setup-${version}.exe`)}`);
