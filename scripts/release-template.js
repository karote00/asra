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
 *   - Add standard devDependencies (ESLint, Prettier, etc.)
 *   - Copy root ESLint/Prettier config
 *   - Copy prod app .gitignore
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
fse.copySync(SRC_DIR, DEST_DIR, {
  filter: (src) => {
    const relPath = path.relative(SRC_DIR, src);
    // Exclude CHANGELOG.md from being copied
    if (relPath === 'CHANGELOG.md') return false;
    return true;
  }
});

// ----------------------
// Remove unnecessary files
// ----------------------
if (VERBOSE) console.log('Removing unnecessary files...');
for (const pattern of CLEAN_FILES) {
  const files = glob.sync(`${DEST_DIR}/**/${pattern}`, { nodir: true });
  for (const file of files) {
    fs.unlinkSync(file);
    if (VERBOSE) console.log(`Deleted file: ${file}`);
  }
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

  // ----------------------
  // Add standard ESLint / Prettier devDependencies
  // ----------------------
  const standardDevDeps = {
    "@eslint/compat": "^2.0.1",
    "@eslint/js": "^9.39.2",
    "eslint": "^9.39.2",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-prettier": "^5.5.5",
    "eslint-plugin-react": "^7.37.5",
    "typescript-eslint": "^8.54.0"
  };
  pkg.devDependencies = pkg.devDependencies || {};
  Object.assign(pkg.devDependencies, standardDevDeps);
  if (VERBOSE) console.log('Added standard ESLint/Prettier devDependencies');

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  if (VERBOSE) console.log('package.json updated ✅');
}

// ----------------------
// Copy root ESLint / Prettier configs
// ----------------------
const rootConfigs = ['.eslintrc.js', '.prettierrc'];
for (const file of rootConfigs) {
  const srcFile = path.resolve(file);
  const destFile = path.join(DEST_DIR, file);
  if (fs.existsSync(srcFile)) {
    fse.copySync(srcFile, destFile);
    if (VERBOSE) console.log(`Copied ${file} to template`);
  }
}

// ----------------------
// Copy prod app .gitignore
// ----------------------
const gitignoreSrc = path.join(SRC_DIR, '.gitignore');
const gitignoreDest = path.join(DEST_DIR, '.gitignore');
if (fs.existsSync(gitignoreSrc)) {
  fse.copySync(gitignoreSrc, gitignoreDest);
  if (VERBOSE) console.log('Copied .gitignore to template');
}

console.log(`Release of "${APP_NAME}" finished!`);
