#!/usr/bin/env node
/**
 * release-full.js
 *
 * Usage:
 *   yarn release:full --prod=<app-name> --otp=<otp-code>
 *
 * Full release workflow (corrected for Changesets):
 * 1. bump:workspace --env=prod (convert workspace:* -> actual versions)
 * 2. changeset version (compute new versions based on .changeset)
 * 3. changeset publish
 * 4. release:app --prod=<app-name>
 * 5. release:full --prod=<app-name> --otp=<otp-code>
 * 6. bump:workspace --env=dev (restore workspace:* for dev)
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
let PROD_APP = null;
let OTP_CODE = null;

// Parse CLI args
args.forEach(arg => {
  if (arg.startsWith('--prod=')) PROD_APP = arg.split('=')[1];
  else if (arg.startsWith('--otp=')) OTP_CODE = arg.split('=')[1];
  else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }
});

if (!PROD_APP) {
  console.error('Must specify --prod=<app-name>');
  process.exit(1);
}

if (!OTP_CODE) {
  console.error('Must specify --otp=<otp-code>');
  process.exit(1);
}

// Helper to run shell commands, will stop if command fails
function run(cmd, options = {}) {
  console.log(`\n> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', ...options });
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}`);
    process.exit(1);
  }
}

// 1️⃣ changeset version (no arguments!)
run('yarn changeset version');

// 2️⃣ bump:workspace --env=prod (convert workspace:* -> actual versions)
run('yarn bump:workspace --env=prod');

// 3️⃣ changeset publish
run('yarn changeset publish');

// 4️⃣ release:app
run(`yarn release:app --prod=${PROD_APP}`);

// 5️⃣ release:full with OTP
run(`yarn release:full --prod=${PROD_APP} --otp=${OTP_CODE}`);

// 6️⃣ bump:workspace --env=dev (restore workspace:* for dev)
run('yarn bump:workspace --env=dev');

console.log('\n✅ Full release completed!');
