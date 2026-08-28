#!/usr/bin/env node
/**
 * release-full.js
 *
 * Usage:
 *   yarn release:full --prod=<app-name>
 *
 * Full release workflow:
 * 1. compute versions from the existing changesets
 * 2. regenerate and validate the app template and release artifacts while
 *    workspace ranges remain in development mode
 * 3. convert workspace ranges to exact publishable versions
 * 4. publish packages
 * 5. restore workspace ranges even when validation or publish fails
 */

import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
let PROD_APP = null
let PRINT_PLAN = false

// Parse CLI args
args.forEach((arg) => {
  if (arg.startsWith('--prod=')) PROD_APP = arg.split('=')[1]
  else if (arg === '--plan') PRINT_PLAN = true
  else {
    console.error(`Unknown argument: ${arg}`)
    process.exit(1)
  }
})

if (!PROD_APP) {
  console.error('Must specify --prod=<app-name>')
  process.exit(1)
}

const releasePlan = {
  prepare: [
    'yarn changeset version',
    `yarn release:app --prod=${PROD_APP}`,
    `yarn release:validate --prod=${PROD_APP}`,
    'yarn bump:workspace --env=release',
    'yarn release:ranges:check'
  ],
  publish: ['yarn changeset publish'],
  finally: ['yarn bump:workspace --env=dev']
}

if (PRINT_PLAN) {
  process.stdout.write(`${JSON.stringify(releasePlan, null, 2)}\n`)
  process.exit(0)
}

function run(cmd, options = {}) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', ...options })
}

let productionRangesApplied = false
let releaseFailed = false

try {
  run(releasePlan.prepare[0])
  run(releasePlan.prepare[1])
  run(releasePlan.prepare[2])
  run(releasePlan.prepare[3])
  productionRangesApplied = true
  run(releasePlan.prepare[4])
  run(releasePlan.publish[0])
} catch (error) {
  releaseFailed = true
  console.error(`Release failed: ${error.message}`)
} finally {
  if (productionRangesApplied) {
    try {
      run(releasePlan.finally[0])
    } catch (error) {
      releaseFailed = true
      console.error(`Workspace dependency restoration failed: ${error.message}`)
    }
  }
}

if (releaseFailed) process.exit(1)
console.log('\nFull release completed')
