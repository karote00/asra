#!/usr/bin/env node
/**
 * bump-workspace-versions.js
 *
 * Usage:
 *   # prod mode: fix workspace dependencies to actual version
 *   yarn bump:workspace --env=prod
 *
 *   # dev mode: restore workspace:* for local development
 *   yarn bump:workspace --env=dev
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
let ENV = 'prod';

args.forEach(arg => {
  if (arg.startsWith('--env=')) ENV = arg.split('=')[1];
});

const rootDir = process.cwd();
const packagesDir = ['packages', 'apps', 'create-app'].map(d => path.join(rootDir, d));

/** Helper to read JSON file */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/** Helper to write JSON file */
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// Step 1: scan all packages, cache their current version
const versionCache = {}; // packageName => version

packagesDir.forEach(baseDir => {
  if (!fs.existsSync(baseDir)) return;
  fs.readdirSync(baseDir).forEach(pkgName => {
    const pkgPath = path.join(baseDir, pkgName, 'package.json');
    if (!fs.existsSync(pkgPath)) return;
    const pkgJson = readJson(pkgPath);
    versionCache[pkgJson.name] = pkgJson.version;
  });
});

// Step 2: traverse all packages and update @asyra/* dependencies
packagesDir.forEach(baseDir => {
  if (!fs.existsSync(baseDir)) return;
  fs.readdirSync(baseDir).forEach(pkgName => {
    const pkgPath = path.join(baseDir, pkgName, 'package.json');
    if (!fs.existsSync(pkgPath)) return;
    const pkgJson = readJson(pkgPath);
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
      if (!pkgJson[depType]) return;
      Object.keys(pkgJson[depType]).forEach(dep => {
        if (!dep.startsWith('@asyra/')) return;
        if (ENV === 'dev') {
          pkgJson[depType][dep] = 'workspace:*';
        } else {
          if (versionCache[dep]) {
            pkgJson[depType][dep] = versionCache[dep];
          }
        }
      });
    });
    writeJson(pkgPath, pkgJson);
  });
});

console.log(`✅ bump-workspace-versions completed (env=${ENV})`);
