import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

const ignoredDirectoryNames = new Set([
  '.git',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
  'tmp'
])

const dedicatedE2ERoots = [
  'apps/asyra-design/e2e/',
  'create-app/asyra-design/template/e2e/'
]

const testFilePattern = /\.(?:test|spec)\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/

const collectMisplacedTestFiles = async (directory, relativeDirectory = '') => {
  const entries = await readdir(directory, { withFileTypes: true })
  const violations = []

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
      continue
    }

    const relativePath = path.posix.join(relativeDirectory, entry.name)
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      violations.push(
        ...(await collectMisplacedTestFiles(absolutePath, relativePath))
      )
      continue
    }

    if (!entry.isFile() || !testFilePattern.test(entry.name)) {
      continue
    }

    const isInTestDirectory = relativePath.split('/').includes('__tests__')
    const isDedicatedE2ESpec = dedicatedE2ERoots.some((root) =>
      relativePath.startsWith(root)
    )
    if (!isInTestDirectory && !isDedicatedE2ESpec) {
      violations.push(relativePath)
    }
  }

  return violations
}

test('unit, integration, and contract tests live in __tests__ directories', async () => {
  const violations = (await collectMisplacedTestFiles(repositoryRoot)).sort()

  assert.deepEqual(
    violations,
    [],
    [
      'Move each test beside its corresponding source area under __tests__.',
      'Dedicated Playwright e2e suites remain under their e2e directories.',
      ...violations
    ].join('\n')
  )
})

test('Framework active plans do not retain completed-plan redirects', async () => {
  const activePlansRoot = path.join(repositoryRoot, 'docs/ai/framework/plans')
  const completedPlansRoot = path.join(activePlansRoot, 'completed')
  const activePlanNames = (
    await readdir(activePlansRoot, {
      withFileTypes: true
    })
  )
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
  const completedPlanNames = new Set(
    (await readdir(completedPlansRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
  )
  const violations = activePlanNames
    .filter((name) => completedPlanNames.has(name))
    .sort()

  assert.deepEqual(
    violations,
    [],
    [
      'Framework plans/ represents work that is not yet complete.',
      'Remove completed-plan redirects and link directly to plans/completed/.',
      ...violations
    ].join('\n')
  )
})
