import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { FRAMEWORK_RELEASE_PACKAGE_NAMES } from '../framework-release-packages.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const supportedNodeRange = '24.x'
const supportedYarnVersion = '4.3.1'

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'))

const readText = (relativePath) =>
  fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')

test('the executing validation runtime is Node.js 24 with Yarn 4.3.1', () => {
  assert.equal(Number.parseInt(process.versions.node.split('.')[0], 10), 24)
  assert.equal(
    execFileSync('yarn', ['--version'], {
      cwd: repositoryRoot,
      encoding: 'utf8'
    }).trim(),
    supportedYarnVersion
  )
})

test('the repository root manifest requires Node.js 24 and Yarn 4.3.1', () => {
  const rootManifest = readJson('package.json')

  assert.deepEqual(rootManifest.engines, {
    node: supportedNodeRange,
    yarn: '>=4.3.1'
  })
  assert.equal(rootManifest.packageManager, 'yarn@4.3.1')
})

test('Framework packages, Asyra Design, and clean consumer require Node.js 24', () => {
  const manifestPaths = [
    ...FRAMEWORK_RELEASE_PACKAGE_NAMES.map(
      (name) => `packages/${name.slice('@asyra/'.length)}/package.json`
    ),
    'apps/asyra-design/package.json',
    'fixtures/framework-release-consumer/package.json'
  ]
  const runtimeContracts = manifestPaths.map((manifestPath) => ({
    manifestPath,
    node: readJson(manifestPath).engines?.node ?? null
  }))

  assert.deepEqual(
    runtimeContracts,
    manifestPaths.map((manifestPath) => ({
      manifestPath,
      node: supportedNodeRange
    }))
  )
})

test('release artifacts and consumers enforce Node.js 24', () => {
  const contracts = [
    {
      path: 'scripts/release-package-artifacts.js',
      patterns: [/manifest\.engines\?\.node !== '24\.x'/]
    },
    {
      path: 'scripts/release-readiness.js',
      patterns: [/major !== 24/, /requires Node 24\.x/]
    },
    {
      path: 'scripts/release-template-readiness.js',
      patterns: [
        /manifest\.engines\?\.node !== '24\.x'/,
        /requires Node 24\.x/,
        /major !== 24/
      ]
    }
  ]

  for (const contract of contracts) {
    const source = readText(contract.path)
    for (const pattern of contract.patterns) {
      assert.match(source, pattern, `${contract.path} ${pattern}`)
    }
    assert.doesNotMatch(source, /Node(?:\.js)? 20\.x|'20\.x'/)
  }
})

test('the official generator writes the Node.js 24 contract', () => {
  const source = readText('scripts/release-template.js')

  assert.match(source, /node: '24\.x'/)
  assert.doesNotMatch(source, /Node(?:\.js)? 20\.x|'20\.x'/)
})

test('the generated template contract requires Node.js 24 and Yarn 4.3.1', () => {
  const manifest = readJson('create-app/asyra-design/template/package.json')
  const sourceReadme = readText('apps/asyra-design/README.md')
  const generatedReadme = readText('create-app/asyra-design/template/README.md')

  assert.deepEqual(manifest.engines, { node: supportedNodeRange })
  assert.equal(manifest.packageManager, 'yarn@4.3.1')
  assert.equal(
    generatedReadme,
    sourceReadme.replaceAll('../../LICENSE', 'LICENSE')
  )
  assert.match(generatedReadme, /Node\.js 24\.x/)
  assert.doesNotMatch(generatedReadme, /Node\.js 20\.x/)
})

test('all GitHub Actions Node setup owners select the Node.js 24 line', () => {
  for (const workflowPath of [
    '.github/workflows/main.yml',
    '.github/workflows/e2e.yml'
  ]) {
    const workflow = readText(workflowPath)
    const versions = [
      ...workflow.matchAll(/node-version:\s*['"]?([^'"\s]+)['"]?/g)
    ].map((match) => match[1])

    assert.ok(versions.length > 0, `${workflowPath} Node setup`)
    assert.equal(
      versions.every((version) => /^24(?:\.|$)/.test(version)),
      true,
      `${workflowPath} versions: ${versions.join(', ')}`
    )
    assert.doesNotMatch(workflow, /Setup Node\.js 20|node-version:\s*['"]?20/)
  }
})

test('the Vercel project-root manifest selects Node.js 24 without a conflicting custom runtime', () => {
  const appManifest = readJson('apps/asyra-design/package.json')
  const vercelConfig = readJson('vercel.json')

  assert.deepEqual(appManifest.engines, { node: supportedNodeRange })
  assert.equal(vercelConfig.version, 2)
  assert.equal(vercelConfig.functions, undefined)
  assert.doesNotMatch(JSON.stringify(vercelConfig), /nodejs20|20\.x/i)
})

test('current public support records require Node.js 24 without a legacy-major fallback', () => {
  const supportPaths = [
    'README.md',
    'CHANGELOG.md',
    'RELEASE_NOTES.md',
    ...FRAMEWORK_RELEASE_PACKAGE_NAMES.map(
      (name) => `packages/${name.slice('@asyra/'.length)}/README.md`
    ),
    'apps/asyra-design/README.md',
    'create-app/asyra-design/template/README.md',
    'docs/ai/framework/RELEASE_SUPPORT.md',
    'docs/ai/workflows/package-release-validation.md',
    'scripts/release-records.js'
  ]

  for (const supportPath of supportPaths) {
    const contents = readText(supportPath)

    assert.match(contents, /Node\.js 24\.x/, supportPath)
    assert.doesNotMatch(contents, /Node(?:\.js)? 20(?:\.x)?/, supportPath)
  }
})
