/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { captureSource } = require('../snapshot.cjs')
const { loadContract } = require('../contracts.cjs')
const root = path.resolve(__dirname, '../../../..')
const parent = path.join(root, 'tmp/flow-inspector/snapshot-tests')
fs.mkdirSync(parent, { recursive: true })

test('captures exact source bytes once and preserves them independently of the checkout', (t) => {
  const output = fs.mkdtempSync(path.join(parent, 'run-'))
  t.after(() => fs.rmSync(output, { recursive: true, force: true }))
  const contract = loadContract(root)
  const originalRead = fs.readFileSync
  const read = t.mock.method(fs, 'readFileSync', (...args) =>
    originalRead(...args)
  )
  const snapshot = captureSource(root, output, contract)
  assert.equal(read.mock.callCount(), snapshot.fileCount)
  read.mock.restore()
  assert.ok(snapshot.fileCount > 10)
  assert.equal(snapshot.fileCount, snapshot.files.length)
  assert.equal(snapshot.fileCount, snapshot.readCount)
  assert.equal(snapshot.contractDigest, contract.digest)
  const source = 'packages/factory/src/data-transact.ts'
  assert.equal(
    fs.readFileSync(path.join(snapshot.sourceRoot, source), 'utf8'),
    fs.readFileSync(path.join(root, source), 'utf8')
  )
  assert.ok(snapshot.files.find((item) => item.path === 'yarn.lock'))
  for (const packageFile of snapshot.files.filter((item) =>
    /^packages\/[^/]+\/package.json$/.test(item.path)
  )) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(snapshot.sourceRoot, packageFile.path))
    )
    for (const dependency of Object.keys(manifest.dependencies ?? {}).filter(
      (name) => name.startsWith('@asyra/')
    )) {
      const entry =
        'packages/' + dependency.slice('@asyra/'.length) + '/src/index.ts'
      assert.ok(
        snapshot.files.some((item) => item.path === entry),
        'Missing source dependency: ' + dependency
      )
    }
  }
  assert.equal(snapshot.kind, 'worktree-snapshot')
  assert.match(snapshot.digest, /^[a-f0-9]{64}$/)
  assert.throws(() => captureSource(root, output, contract), /exists/)
})

test('rejects symlinked source files before executing code', (t) => {
  const fixture = fs.mkdtempSync(path.join(parent, 'fixture-'))
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }))
  fs.mkdirSync(path.join(fixture, 'packages/factory/src'), { recursive: true })
  fs.symlinkSync(
    path.join(root, 'packages/factory/src/index.ts'),
    path.join(fixture, 'packages/factory/src/index.ts')
  )
  assert.throws(
    () =>
      captureSource(fixture, path.join(fixture, 'attempt'), loadContract(root)),
    /symlink/i
  )
})
