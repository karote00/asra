#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  FRAMEWORK_RELEASE_PACKAGE_NAMES,
  readFrameworkReleaseSource
} from './framework-release-packages.js'

const RELEASE_TYPES = Object.freeze(['patch', 'minor', 'major'])

export const parseReleaseType = (args) => {
  const values = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--type') {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error('--type requires patch, minor, or major')
      }
      values.push(value)
      index += 1
      continue
    }
    if (arg.startsWith('--type=')) {
      values.push(arg.slice('--type='.length))
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  if (values.length === 0) {
    throw new Error('--type is required for the exceptional generator')
  }
  if (values.length !== 1) {
    throw new Error('--type must be provided exactly once')
  }

  const [releaseType] = values
  if (!RELEASE_TYPES.includes(releaseType)) {
    throw new Error(`Unsupported Changesets release type: ${releaseType}`)
  }
  return releaseType
}

const readPendingChangesets = (repositoryRoot) => {
  const changesetDirectory = path.join(repositoryRoot, '.changeset')
  if (!fs.existsSync(changesetDirectory)) return []
  return fs
    .readdirSync(changesetDirectory)
    .filter((entry) => entry.endsWith('.md') && entry !== 'README.md')
    .sort()
}

const validateFrameworkManifests = (repositoryRoot) => {
  const uniqueNames = new Set(FRAMEWORK_RELEASE_PACKAGE_NAMES)
  if (uniqueNames.size !== FRAMEWORK_RELEASE_PACKAGE_NAMES.length) {
    throw new Error('Framework release allowlist contains duplicate names')
  }

  const source = readFrameworkReleaseSource({ repositoryRoot })
  const sourceNames = source.packages.map((record) => record.name)
  if (
    sourceNames.length !== FRAMEWORK_RELEASE_PACKAGE_NAMES.length ||
    sourceNames.some(
      (packageName, index) =>
        packageName !== FRAMEWORK_RELEASE_PACKAGE_NAMES[index]
    )
  ) {
    throw new Error(
      'Framework release source does not match the fixed allowlist'
    )
  }
}

export const buildChangesetContent = ({ packageNames, releaseType }) => {
  const packageLines = packageNames
    .map((packageName) => `"${packageName}": ${releaseType}`)
    .join('\n')

  return `---
${packageLines}
---
Exceptional synchronized ${releaseType} release for the fixed 19-package Framework set.
`
}

export const createFrameworkChangesetPlan = ({
  repositoryRoot,
  releaseType
}) => {
  if (!RELEASE_TYPES.includes(releaseType)) {
    throw new Error(`Unsupported Changesets release type: ${releaseType}`)
  }

  const resolvedRoot = path.resolve(repositoryRoot)
  const pendingChangesets = readPendingChangesets(resolvedRoot)
  if (pendingChangesets.length > 0) {
    throw new Error(
      `Exceptional generator requires an empty pending Changeset set; found ${pendingChangesets.join(
        ', '
      )}`
    )
  }

  validateFrameworkManifests(resolvedRoot)
  const packageNames = [...FRAMEWORK_RELEASE_PACKAGE_NAMES]
  return Object.freeze({
    releaseType,
    packageNames: Object.freeze(packageNames),
    outputPath: path.join(resolvedRoot, '.changeset', `auto-${releaseType}.md`),
    content: buildChangesetContent({ packageNames, releaseType })
  })
}

export const writeFrameworkChangeset = (plan) => {
  fs.mkdirSync(path.dirname(plan.outputPath), { recursive: true })
  fs.writeFileSync(plan.outputPath, plan.content, 'utf8')
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
  )
  const releaseType = parseReleaseType(process.argv.slice(2))
  const plan = createFrameworkChangesetPlan({
    repositoryRoot,
    releaseType
  })
  writeFrameworkChangeset(plan)
  process.stdout.write(
    `Generated ${path.relative(repositoryRoot, plan.outputPath)} for ${plan.packageNames.length} Framework packages at ${releaseType}.\n`
  )
}
