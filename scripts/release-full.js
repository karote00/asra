#!/usr/bin/env node
/**
 * release-full.js
 *
 * Usage:
 *   yarn release:full --prod=<app-name>
 *
 * Full release workflow (corrected for Changesets):
 * 1. bump:workspace --env=prod (convert workspace:* -> actual versions)
 * 2. changeset version (compute new versions based on .changeset)
 * 3. changeset publish (will prompt for OTP if needed)
 * 4. release:app --prod=<app-name>
 * 5. release:full --prod=<app-name>
 * 6. bump:workspace --env=dev (restore workspace:* for dev)
 */

import { execSync } from 'child_process'

const args = process.argv.slice(2)
let PROD_APP = null

// Parse CLI args
args.forEach((arg) => {
  if (arg.startsWith('--prod=')) PROD_APP = arg.split('=')[1]
  else {
    console.error(`Unknown argument: ${arg}`)
    process.exit(1)
  }
})

if (!PROD_APP) {
  console.error('Must specify --prod=<app-name>')
  process.exit(1)
}

// Helper to run shell commands, will stop if command fails
function run(cmd, options = {}) {
  console.log(`\n> ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', ...options })
  } catch {
    console.error(`❌ Command failed: ${cmd}`)
    process.exit(1)
  }
}

// 1️⃣ changeset version
run('yarn changeset version')

// 2️⃣ bump:workspace --env=prod
run('yarn bump:workspace --env=prod')

// 3️⃣ changeset publish (will prompt OTP automatically if required)
run('yarn changeset publish')

// 4️⃣ release:app
run(`yarn release:app --prod=${PROD_APP}`)

// 5️⃣ bump:workspace --env=dev
run('yarn bump:workspace --env=dev')

console.log('\n✅ Full release completed!')
