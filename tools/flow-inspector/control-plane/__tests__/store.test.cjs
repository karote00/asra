/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const test = require('node:test')
const { openStore } = require('../store.cjs')
const parent = path.resolve(
  __dirname,
  '../../../../tmp/flow-inspector/store-tests'
)
const fixture = (t) => {
  fs.mkdirSync(parent, { recursive: true })
  const directory = fs.mkdtempSync(path.join(parent, 'store-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return directory
}
const attempt = () => ({
  format: 1,
  id: randomUUID(),
  phase: 'running',
  actor: 'local',
  scenario: 'baseline',
  flowIds: ['deferred-publication'],
  startedAt: new Date().toISOString(),
  audit: [{ event: 'admitted', at: new Date().toISOString() }]
})
test('enforces exclusive ownership and interrupts an unfinished run on restart', (t) => {
  const directory = fixture(t)
  const first = openStore(directory)
  const record = attempt()
  first.save(record)
  assert.throws(() => openStore(directory), /already owned/)
  first.close()
  const second = openStore(directory)
  assert.equal(second.get(record.id).phase, 'interrupted')
  assert.equal(
    second.get(record.id).audit.at(-1).event,
    'interrupted-on-restart'
  )
  assert.throws(() => second.save(record), /immutable/)
  assert.ok(Object.isFrozen(second.get(record.id).audit))
  second.close()
})
test('ignores interrupted temporary writes and rejects malformed durable records', (t) => {
  const directory = fixture(t)
  const store = openStore(directory)
  const record = attempt()
  store.save(record)
  store.close()
  fs.writeFileSync(
    path.join(directory, record.id, 'record.json.partial.tmp'),
    '{'
  )
  const recovered = openStore(directory)
  recovered.close()
  fs.writeFileSync(
    path.join(directory, record.id, 'record.json'),
    JSON.stringify({ ...record, phase: 'made-up-pass' })
  )
  assert.throws(() => openStore(directory), /Invalid attempt/)
})
test('repeated reads use admitted records without rereading source or history files', (t) => {
  const store = openStore(fixture(t))
  const record = attempt()
  store.save(record)
  const original = fs.readFileSync
  const reads = t.mock.method(fs, 'readFileSync', (...args) =>
    original(...args)
  )
  for (let i = 0; i < 25; i++) {
    store.get(record.id)
    store.list()
  }
  assert.equal(reads.mock.callCount(), 0)
  store.close()
})
test('restart refuses to overlap a still-live interrupted runner', (t) => {
  const directory = fixture(t)
  const store = openStore(directory)
  store.save({ ...attempt(), runnerPid: process.pid })
  store.close()
  assert.throws(() => openStore(directory), /still settling/)
})
test('restart rejects symlinked attempt directories before writing recovery', (t) => {
  const directory = fixture(t)
  const target = fixture(t)
  const record = attempt()
  fs.writeFileSync(path.join(target, 'record.json'), JSON.stringify(record))
  fs.symlinkSync(target, path.join(directory, record.id))
  assert.throws(() => openStore(directory), /Symlinked attempt directory/)
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(target, 'record.json'))).phase,
    'running'
  )
})
