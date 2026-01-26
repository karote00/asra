#!/usr/bin/env node
/**
 * release-template.js
 * 
 * Usage:
 *   yarn release --prod=asyra-design
 *   yarn release --prod=asyra-whiteboard
 *   yarn release --prod=asyra-design --verbose
 *
 * Features:
 *   - Read config for each app
 *   - Copy source files to release template folder
 *   - Clean unnecessary files (lock files, node_modules, .env, etc.)
 *   - Update @asyra/* dependencies to fixed versions from packages/
 *   - Optional verbose output
 */

import fs from 'fs';
import path from 'path';
import fse from 'fs-extra';
import * as glob from 'glob';

// ----------------------
// Parse CLI arguments
// ----------------------
const args = process.argv.slice(2);
let APP_NAME = 'asyra-design';
let VERBOSE = false;

for (const arg of args) {
  if (arg.startsWith('--prod=')) {
    APP_NAME = arg.split('=')[1];
  } else if (arg === '--verbose') {
    VERBOSE = true;
  } else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }
}

// ----------------------
// Load config JSON
// ----------------------
const CONFIG_FILE = path.resolve(`release-configs/${APP_NAME}.json`);
if (!fs.existsSync(CONFIG_FILE)) {
  console.error(`Config file ${CONFIG_FILE} not found!`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
const SRC_DIR = path.resolve(config.src);
const DEST_DIR = path.resolve(config.dest);
const CLEAN_FILES = config.cleanFiles || [];

console.log(`Releasing "${APP_NAME}"`);
console.log(`SRC_DIR: ${SRC_DIR}`);
console.log(`DEST_DIR: ${DEST_DIR}`);
console.log(`Files/folders to clean: ${CLEAN_FILES.join(', ')}`);

// ----------------------
// Remove old template
// ----------------------
if (fs.existsSync(DEST_DIR)) {
  if (VERBOSE) console.log(`Cleaning old template at ${DEST_DIR}...`);
  fse.removeSync(DEST_DIR);
}
fse.mkdirpSync(DEST_DIR);

// ----------------------
// Copy source files
// ----------------------
if (VERBOSE) console.log('Copying files...');
fse.copySync(SRC_DIR, DEST_DIR);

// ----------------------
// Remove unnecessary files
// ----------------------
if (VERBOSE) console.log('Removing unnecessary files...');
for (const pattern of CLEAN_FILES) {
  // Delete files matching pattern
  const files = glob.sync(`${DEST_DIR}/**/${pattern}`, { nodir: true });
  for (const file of files) {
    fs.unlinkSync(file);
    if (VERBOSE) console.log(`Deleted file: ${file}`);
  }

  // Delete directories matching pattern
  const dirs = glob.sync(`${DEST_DIR}/**/${pattern}`, { onlyDirectories: true });
  for (const dir of dirs) {
    fse.removeSync(dir);
    if (VERBOSE) console.log(`Deleted dir: ${dir}`);
  }
}

// ----------------------
// Update @asyra/* dependencies
// ----------------------
if (VERBOSE) console.log('Updating @asyra/* dependencies...');
const pkgPath = path.join(DEST_DIR, 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.warn(`No package.json found at ${pkgPath}, skipping dependency update`);
} else {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const packagesDir = path.resolve('packages');

  function updateDeps(deps) {
    if (!deps) return;
    for (const depName of Object.keys(deps)) {
      if (depName.startsWith('@asyra/')) {
        const localPkgPath = path.join(packagesDir, depName.replace('@asyra/', ''), 'package.json');
        if (fs.existsSync(localPkgPath)) {
          const localPkg = JSON.parse(fs.readFileSync(localPkgPath, 'utf-8'));
          deps[depName] = localPkg.version;
          if (VERBOSE) console.log(`Set ${depName} => ${localPkg.version}`);
        }
      }
    }
  }

  updateDeps(pkg.dependencies);
  updateDeps(pkg.devDependencies);
  updateDeps(pkg.peerDependencies);

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  if (VERBOSE) console.log('package.json updated ✅');
}

console.log(`Release of "${APP_NAME}" finished!`);
