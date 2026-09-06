/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const vm = require('node:vm')
const { admitContract } = require('./contracts.cjs')

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sourcePackages = ['factory', 'reactive-events', 'utils', 'persistence']

function safePath(root, relative) {
  const resolved = path.resolve(root, relative)
  if (!resolved.startsWith(path.resolve(root) + path.sep))
    throw new Error('Source path escapes repository')
  let current = path.resolve(root)
  for (const part of path.relative(root, resolved).split(path.sep)) {
    current = path.join(current, part)
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error('Symlinked proof path: ' + relative)
  }
  return resolved
}

function captureSource(repositoryRoot, runDirectory, contract) {
  const sourceRoot = safePath(
    repositoryRoot,
    path.relative(repositoryRoot, path.join(runDirectory, 'source'))
  )
  if (fs.existsSync(sourceRoot)) throw new Error('Snapshot already exists')
  const paths = new Set()
  const walk = (relative) => {
    const absolute = safePath(repositoryRoot, relative)
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isSymbolicLink())
        throw new Error(
          'Symlinked proof source: ' + relative + '/' + entry.name
        )
      if (entry.name === '__tests__') continue
      const child = relative + '/' + entry.name
      if (entry.isDirectory()) walk(child)
      else if (entry.isFile()) paths.add(child)
      else throw new Error('Unsupported source file: ' + child)
    }
  }
  for (const name of sourcePackages) {
    walk('packages/' + name + '/src')
    paths.add('packages/' + name + '/package.json')
  }
  for (const relative of [
    contract.manifestPath,
    contract.architecturePath,
    contract.specPath,
    contract.testFile,
    contract.configFile,
    'package.json',
    'yarn.lock'
  ])
    paths.add(relative)
  fs.mkdirSync(sourceRoot, { recursive: true })
  const files = []
  const captured = new Map()
  for (const relative of [...paths].sort()) {
    const input = safePath(repositoryRoot, relative)
    if (!fs.lstatSync(input).isFile())
      throw new Error('Expected a regular source file')
    const bytes = fs.readFileSync(input)
    const output = path.join(sourceRoot, relative)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, bytes, { flag: 'wx', mode: 0o444 })
    files.push({ path: relative, digest: sha256(bytes), size: bytes.length })
    captured.set(relative, bytes)
  }
  const manifest = JSON.parse(captured.get(contract.manifestPath).toString())
  for (const name of sourcePackages) {
    const metadata = JSON.parse(
      captured.get('packages/' + name + '/package.json').toString()
    )
    for (const dependency of Object.keys(metadata.dependencies ?? {})) {
      if (
        dependency.startsWith('@asyra/') &&
        !sourcePackages.includes(dependency.slice('@asyra/'.length))
      )
        throw new Error('Undeclared source dependency: ' + dependency)
    }
  }
  const sandbox = { module: { exports: {} }, globalThis: {} }
  vm.runInNewContext(
    captured.get(contract.architecturePath).toString(),
    sandbox,
    { timeout: 1000 }
  )
  const capturedContract = admitContract(manifest, sandbox.module.exports)
  if (capturedContract.digest !== contract.digest)
    throw new Error(
      'Contract changed during capture; retry with current contract'
    )
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  }).trim()
  return {
    kind: 'worktree-snapshot',
    sourceRoot,
    digest: sha256(JSON.stringify(files)),
    contractDigest: contract.digest,
    head,
    files,
    fileCount: files.length,
    readCount: files.length
  }
}

module.exports = { captureSource, safePath, sha256 }
