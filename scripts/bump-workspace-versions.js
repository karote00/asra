#!/usr/bin/env node
/**
 * bump-workspace-versions.js
 *
 * Usage:
 *   # prod mode: fix workspace dependencies to actual version (with ^)
 *   yarn bump:workspace --env=prod
 *
 *   # dev mode: restore workspace:* for local development
 *   yarn bump:workspace --env=dev
 *
 *   # release mode: use exact internal versions for validated publication
 *   yarn bump:workspace --env=release
 *
 * Logs each package and which dependencies were updated.
 */

import {
  applyWorkspaceVersionPlan,
  createWorkspaceVersionPlan
} from './workspace-versions.js'

const args = process.argv.slice(2)
let environment = 'prod'

args.forEach((arg) => {
  if (arg.startsWith('--env=')) environment = arg.split('=')[1]
  else {
    console.error(`Unknown argument: ${arg}`)
    process.exit(1)
  }
})

const plan = createWorkspaceVersionPlan({
  rootDirectory: process.cwd(),
  environment
})
applyWorkspaceVersionPlan(plan)

for (const { packageName, updates } of plan) {
  console.log(`\nUpdated ${packageName}:`)
  updates.forEach((update) => console.log(`   ${update}`))
}

console.log(`\nbump-workspace-versions completed (env=${environment})`)
