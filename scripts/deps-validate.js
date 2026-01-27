#!/usr/bin/env node
/**
 * deps-validate.js
 *
 * Validate internal monorepo dependencies:
 * - Only checks imports like: from '@asyra/*'
 * - Ensures dependency exists in package.json dependencies
 * - Disallows self-dependency
 * - Reports all issues at once
 *
 * Usage:
 *   yarn deps:validate
 *   yarn deps:validate --verbose
 */

import fs from 'fs';
import path from 'path';
import process from 'process';
import { glob } from 'glob';

// ----------------------
// CLI args
// ----------------------
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');

// ----------------------
// Constants
// ----------------------
const ROOT_DIR = process.cwd();
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');
const INTERNAL_SCOPE = '@asyra/';

// Only scan source-like files
const SOURCE_GLOB = '**/*.{ts,tsx,js,jsx}';

// Match: from '@asyra/xxx' | require('@asyra/xxx')
const IMPORT_RE =
  /(?:from\s+['"](@asyra\/[^'"]+)['"]|require\(\s*['"](@asyra\/[^'"]+)['"]\s*\))/g;

// ----------------------
// Helpers
// ----------------------
function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function logVerbose(...args) {
  if (VERBOSE) console.log(...args);
}

// ----------------------
// 1. Load all workspaces
// ----------------------
if (!fs.existsSync(PACKAGES_DIR)) {
  console.error('✖ packages/ directory not found');
  process.exit(1);
}

const workspaceDirs = fs
  .readdirSync(PACKAGES_DIR)
  .map((name) => path.join(PACKAGES_DIR, name))
  .filter((p) => fs.existsSync(path.join(p, 'package.json')));

const workspaces = workspaceDirs.map((dir) => {
  const pkg = readJSON(path.join(dir, 'package.json'));
  return {
    name: pkg.name,
    dir,
    dependencies: Object.keys(pkg.dependencies || {}),
  };
});

const workspaceMap = new Map(workspaces.map((w) => [w.name, w]));

logVerbose(`Found ${workspaces.length} workspaces`);

// ----------------------
// 2. Validate self-dependency
// ----------------------
const selfDepErrors = [];

for (const ws of workspaces) {
  if (ws.dependencies.includes(ws.name)) {
    selfDepErrors.push(ws.name);
  }
}

if (selfDepErrors.length > 0) {
  console.error('\n✖ Invalid dependency configuration\n');
  for (const name of selfDepErrors) {
    console.error(`- ${name} depends on itself`);
  }
  console.error('\nThis is always invalid in a monorepo.');
  process.exit(1);
}

// ----------------------
// 3. Scan imports
// ----------------------
/**
 * missingDeps:
 * Map<
 *   workspaceName,
 *   Map<missingDep, Set<filePaths>>
 * >
 */
const missingDeps = new Map();

for (const ws of workspaces) {
  logVerbose(`\nScanning ${ws.name}`);

  const files = await glob(SOURCE_GLOB, {
    cwd: ws.dir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    let match;

    while ((match = IMPORT_RE.exec(content)) !== null) {
      const importedPkg = match[1] || match[2];
      if (!importedPkg?.startsWith(INTERNAL_SCOPE)) continue;

      // Ignore self import (allowed)
      if (importedPkg === ws.name) continue;

      // Imported workspace must exist
      if (!workspaceMap.has(importedPkg)) {
        // treat as missing dep as well
        if (!missingDeps.has(ws.name)) {
          missingDeps.set(ws.name, new Map());
        }
        const depMap = missingDeps.get(ws.name);
        if (!depMap.has(importedPkg)) {
          depMap.set(importedPkg, new Set());
        }
        depMap.get(importedPkg).add(path.relative(ws.dir, file));
        continue;
      }

      // Check dependency declaration
      if (!ws.dependencies.includes(importedPkg)) {
        if (!missingDeps.has(ws.name)) {
          missingDeps.set(ws.name, new Map());
        }
        const depMap = missingDeps.get(ws.name);
        if (!depMap.has(importedPkg)) {
          depMap.set(importedPkg, new Set());
        }
        depMap.get(importedPkg).add(path.relative(ws.dir, file));
      }
    }
  }
}

// ----------------------
// 4. Report
// ----------------------
if (missingDeps.size === 0) {
  console.log('✔ Dependency validation passed\n');
  console.log(`Workspaces scanned: ${workspaces.length}`);
  console.log('No missing internal dependencies found.');
  process.exit(0);
}

console.error('\n✖ Dependency validation failed\n');
console.error('Missing internal dependencies detected:\n');

for (const [pkgName, deps] of missingDeps.entries()) {
  console.error(`- ${pkgName}`);
  for (const [dep, files] of deps.entries()) {
    console.error(`  → missing dependency: ${dep}`);
    for (const file of files) {
      console.error(`    - ${file}`);
    }
  }
  console.error('');
}

process.exit(1);
