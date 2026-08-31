import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FRAMEWORK_RELEASE_PACKAGE_NAMES } from './framework-release-packages.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

const packageNamesByDirectory = new Map(
  FRAMEWORK_RELEASE_PACKAGE_NAMES.map((packageName) => [
    packageName.slice('@asyra/'.length),
    packageName
  ])
)

const pendingChangesetPattern = /^\.changeset\/[^/]+\.md$/u
const ignoredChangesetFiles = new Set([
  '.changeset/README.md',
  '.changeset/config.json'
])

export const parseNameStatus = (output) =>
  output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split('\t')
      return { status: status[0], path: paths.at(-1) }
    })

export const evaluateChangesetPrDiff = (changes) => {
  const hasPendingChangeset = changes.some(
    ({ status, path: changedPath }) =>
      status !== 'D' &&
      pendingChangesetPattern.test(changedPath) &&
      !ignoredChangesetFiles.has(changedPath)
  )

  if (hasPendingChangeset) {
    return { valid: true, mode: 'pending-changeset', packages: [] }
  }

  const changedPaths = new Set(
    changes.filter(({ status }) => status !== 'D').map(({ path }) => path)
  )
  const materializedPackages = []

  for (const [directory, packageName] of packageNamesByDirectory) {
    if (
      changedPaths.has(`packages/${directory}/package.json`) &&
      changedPaths.has(`packages/${directory}/CHANGELOG.md`)
    ) {
      materializedPackages.push(packageName)
    }
  }

  if (materializedPackages.length > 0) {
    return {
      valid: true,
      mode: 'materialized-release',
      packages: materializedPackages.sort()
    }
  }

  return { valid: false, mode: 'missing', packages: [] }
}

export const runChangesetPrCheck = ({ baseSha, headSha }) => {
  if (!baseSha || !headSha) {
    throw new Error('CHANGESET_BASE_SHA and CHANGESET_HEAD_SHA are required')
  }

  const output = execFileSync(
    'git',
    ['diff', '--name-status', `${baseSha}...${headSha}`],
    { cwd: repositoryRoot, encoding: 'utf8' }
  )
  const result = evaluateChangesetPrDiff(parseNameStatus(output))

  if (!result.valid) {
    throw new Error(
      'PR requires a pending .changeset/*.md record. Release PRs are accepted only after Changesets materializes both package versions and changelogs.'
    )
  }

  const detail =
    result.packages.length > 0 ? `: ${result.packages.join(', ')}` : ''
  process.stdout.write(`Changeset PR check passed (${result.mode})${detail}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runChangesetPrCheck({
      baseSha: process.env.CHANGESET_BASE_SHA,
      headSha: process.env.CHANGESET_HEAD_SHA
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
