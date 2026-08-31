#!/usr/bin/env node

import { execSync } from 'node:child_process'

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

const releasePlan = {
  prepare: [
    'yarn release:consumer:registry',
    `yarn release:app --prod=${product}`,
    `yarn release:validate --prod=${product}`,
    `npm pack ./create-app/${product} --dry-run --json`
  ],
  publish: [`node scripts/publish-create-app.js --prod=${product}`]
}

if (printPlan) {
  process.stdout.write(`${JSON.stringify(releasePlan, null, 2)}\n`)
  process.exit(0)
}

for (const command of [...releasePlan.prepare, ...releasePlan.publish]) {
  console.log(`\n> ${command}`)
  execSync(command, { stdio: 'inherit' })
}

console.log('\nCreate-app release completed')
