import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FRAMEWORK_RELEASE_PACKAGE_NAMES } from '../framework-release-packages.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const rootManifest = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
)
const scriptPath = path.join(repositoryRoot, 'scripts/changeset-all-patch.js')
const scriptSource = fs.readFileSync(scriptPath, 'utf8')
const hasImportSafeContract =
  scriptSource.includes('export const parseReleaseType') &&
  scriptSource.includes('const isDirectInvocation')

test('exceptional Changeset generator declares the fixed allowlist and explicit type contract', () => {
  assert.match(
    scriptSource,
    /FRAMEWORK_RELEASE_PACKAGE_NAMES/,
    'generator must use the Framework release allowlist'
  )
  assert.match(
    scriptSource,
    /export const parseReleaseType/,
    'generator must expose an import-safe type parser'
  )
  assert.match(scriptSource, /--type/)
  assert.doesNotMatch(
    scriptSource,
    /yarn workspaces list/,
    'generator must not rediscover arbitrary public workspaces'
  )
})

test('root script gate includes the exceptional Changeset generator tests', () => {
  assert.match(
    rootManifest.scripts['test:scripts'],
    /scripts\/__tests__\/changeset-all-patch\.test\.mjs/
  )
})

test('release type is required and accepts only Changesets semver types', async (t) => {
  if (!hasImportSafeContract) {
    t.skip('implementation is not import-safe yet')
    return
  }
  const moduleUrl = `${pathToFileURL(scriptPath).href}?test=parse-type`
  const { parseReleaseType } = await import(moduleUrl)

  assert.equal(parseReleaseType(['--type', 'minor']), 'minor')
  assert.equal(parseReleaseType(['--type=patch']), 'patch')
  assert.equal(parseReleaseType(['--type', 'major']), 'major')
  assert.throws(() => parseReleaseType([]), /--type is required/)
  assert.throws(() => parseReleaseType(['--type', 'none']), /Unsupported/)
  assert.throws(
    () => parseReleaseType(['--type', 'minor', '--type=patch']),
    /exactly once/
  )
  assert.throws(() => parseReleaseType(['--unknown']), /Unknown argument/)
})

test('minor plan contains exactly the fixed 19 Framework packages and performs no write', async (t) => {
  if (!hasImportSafeContract) {
    t.skip('implementation is not import-safe yet')
    return
  }
  const moduleUrl = `${pathToFileURL(scriptPath).href}?test=minor-plan`
  const { createFrameworkChangesetPlan } = await import(moduleUrl)
  const plan = createFrameworkChangesetPlan({
    repositoryRoot,
    releaseType: 'minor'
  })

  assert.deepEqual(plan.packageNames, FRAMEWORK_RELEASE_PACKAGE_NAMES)
  assert.equal(plan.packageNames.length, 19)
  assert.equal(
    new Set(plan.packageNames).size,
    FRAMEWORK_RELEASE_PACKAGE_NAMES.length
  )
  assert.equal(path.basename(plan.outputPath), 'auto-minor.md')
  assert.equal(fs.existsSync(plan.outputPath), false)

  for (const packageName of FRAMEWORK_RELEASE_PACKAGE_NAMES) {
    assert.match(plan.content, new RegExp(`"${packageName}": minor`))
  }
  assert.doesNotMatch(plan.content, /"asyra":/)
  assert.doesNotMatch(plan.content, /"@asyra\/asyra-design":/)
  assert.doesNotMatch(plan.content, /"create-asyra-design-app":/)
  assert.match(plan.content, /Exceptional synchronized minor release/)
})
