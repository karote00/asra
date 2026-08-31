#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const productArgument = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--prod='))
const product = productArgument?.slice('--prod='.length)
if (!product || !/^[a-z0-9-]+$/u.test(product)) {
  console.error('Must specify a safe --prod=<app-name>')
  process.exit(1)
}

const directory = path.resolve('create-app', product)
const manifest = JSON.parse(
  fs.readFileSync(path.join(directory, 'package.json'), 'utf8')
)
execFileSync('npm', ['publish', directory, '--access', 'public'], {
  stdio: 'inherit'
})
execFileSync('git', ['tag', `${manifest.name}@${manifest.version}`, 'HEAD'], {
  stdio: 'inherit'
})
