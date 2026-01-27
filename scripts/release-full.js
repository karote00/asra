#!/usr/bin/env node
/**
 * release-full.js
 *
 * Usage:
 *   yarn release:full --prod=<app-name> --version=<major|minor|patch|x.y.z>
 *
 * Full release workflow:
 * 1. changeset version <version>
 * 2. bump:workspace --env=prod (cache versions, fix @asyra/* deps)
 * 3. changeset publish
 * 4. release:app --prod=<app-name>
 * 5. bump:workspace --env=dev (restore workspace:* for dev)
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
let PROD_APP = null;
let VERSION = null;

// Parse CLI args
args.forEach(arg => {
  if (arg.startsWith('--prod=')) PROD_APP = arg.split('=')[1];
  else if (arg.startsWith('--version=')) VERSION = arg.split('=')[1];
  else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }
});

if (!PROD_APP) {
  console.error('Must specify --prod=<app-name>');
  process.exit(1);
}

if (!VERSION) {
  console.error('Must specify --version=<major|minor|patch|x.y.z>');
  process.exit(1);
}

// Helper to run shell commands
function run(cmd, options = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...options });
}

// 1️⃣ changeset version
run(`yarn changeset version ${VERSION}`);

// 2️⃣ bump:workspace --env=prod
run('yarn bump:workspace --env=prod');

// 3️⃣ changeset publish
run('yarn changeset publish');

// 4️⃣ release:app
run(`yarn release:app --prod=${PROD_APP}`);

// 5️⃣ bump:workspace --env=dev
run('yarn bump:workspace --env=dev');

console.log('\n✅ Full release completed!');
