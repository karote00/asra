#!/usr/bin/env node

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const productArgument = args.find((arg) => arg.startsWith('--prod='))
const product = productArgument?.slice('--prod='.length)
const printPlan = args.includes('--plan')

if (!product || !/^[a-z0-9-]+$/u.test(product)) {
  console.error('Must specify a safe --prod=<app-name>')
  process.exit(1)
}
if (args.some((arg) => arg !== productArgument && arg !== '--plan')) {
  console.error('Unknown argument')
  process.exit(1)
}

const releasePlanPath = 'tmp/framework-release-plan.json'
const releasePlan = {
  prepare: [
    `yarn changeset status --output=${releasePlanPath}`,
    'yarn changeset version',
    `yarn release:app --prod=${product}`,
    `yarn release:validate --prod=${product}`,
    'yarn bump:workspace --env=release',
    'yarn release:ranges:check'
  ],
  publish: [
    `node scripts/publish-framework-release.js --plan=${releasePlanPath}`
  ],
  verify: ['yarn release:consumer:registry'],
  finally: ['yarn bump:workspace --env=dev']
}

if (printPlan) {
  process.stdout.write(`${JSON.stringify(releasePlan, null, 2)}\n`)
  process.exit(0)
}

const run = (command) => {
  console.log(`\n> ${command}`)
  execSync(command, { stdio: 'inherit' })
}

let exactRangesApplied = false
try {
  for (const command of releasePlan.prepare) {
    run(command)
    if (command === 'yarn bump:workspace --env=release') {
      exactRangesApplied = true
    }
  }
  releasePlan.publish.forEach(run)
  releasePlan.verify.forEach(run)
} finally {
  if (exactRangesApplied) releasePlan.finally.forEach(run)
  fs.rmSync(path.resolve(releasePlanPath), { force: true })
}

console.log('\nFramework release completed')
