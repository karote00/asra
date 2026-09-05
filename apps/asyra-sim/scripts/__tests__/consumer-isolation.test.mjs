import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import test from 'node:test'
import { isolatedConsumerCommand } from '../consumer-isolation.mjs'

test(
  'real consumer processes cannot read ancestor packages or symlink escapes, while local dependencies remain readable',
  { skip: process.platform !== 'darwin' },
  (t) => {
    const parent = fileURLToPath(
      new URL('../../.artifacts/consumer-tests/', import.meta.url)
    )
    mkdirSync(parent, { recursive: true })
    const fixture = mkdtempSync(path.join(parent, 'isolation-'))
    t.after(() => rmSync(fixture, { recursive: true }))
    const consumer = path.join(fixture, 'nested/consumer'),
      external = path.join(fixture, 'node_modules/parent-only/index.js'),
      local = path.join(consumer, 'node_modules/local-only/index.js')
    mkdirSync(path.dirname(external), { recursive: true })
    mkdirSync(path.dirname(local), { recursive: true })
    writeFileSync(external, 'module.exports = "ancestor"')
    writeFileSync(local, 'module.exports = "local"')
    symlinkSync(external, path.join(consumer, 'escape.js'))
    const script = `const fs = require('node:fs');
    const read = (file) => { try { return fs.readFileSync(file, 'utf8') } catch (error) { return error.code } };
    console.log(JSON.stringify([read(${JSON.stringify(local)}), read(${JSON.stringify(external)}), read('./escape.js')]))`
    const options = { cwd: consumer, encoding: 'utf8' }
    const ordinary = JSON.parse(
      execFileSync(process.execPath, ['-e', script], options)
    )
    assert.match(ordinary[1], /ancestor/)
    const isolated = isolatedConsumerCommand(consumer, process.execPath, [
      '-e',
      script
    ])
    const result = JSON.parse(
      execFileSync(isolated.command, isolated.args, options)
    )
    assert.match(result[0], /local/)
    assert.ok(['EPERM', 'EACCES'].includes(result[1]))
    assert.ok(['EPERM', 'EACCES'].includes(result[2]))
    assert.match(readFileSync(external, 'utf8'), /ancestor/)
    const missing = isolatedConsumerCommand(consumer, process.execPath, [
      '-e',
      "require('parent-only')"
    ])
    assert.throws(() =>
      execFileSync(missing.command, missing.args, { ...options, stdio: 'pipe' })
    )
  }
)
