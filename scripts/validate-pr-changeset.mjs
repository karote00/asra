#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const CHANGESET_SKIP_FLAGS = Object.freeze({
  DOCS_ONLY: 'changeset-skip:docs-only',
  HOTFIX: 'changeset-skip:hotfix'
})

const DOCUMENTATION_EXTENSIONS = new Set(['.adoc', '.md', '.mdx', '.rst'])

const isChangesetRecord = (filePath) => {
  const normalizedPath = filePath.replaceAll('\\', '/')
  return (
    normalizedPath.startsWith('.changeset/') &&
    normalizedPath.endsWith('.md') &&
    normalizedPath !== '.changeset/README.md'
  )
}

export const isDocumentationFile = (filePath) => {
  const normalizedPath = filePath.replaceAll('\\', '/')
  if (normalizedPath.startsWith('docs/')) return true

  const basename = path.posix.basename(normalizedPath)
  if (/^(LICENSE|NOTICE)(\..+)?$/u.test(basename)) return true
  return DOCUMENTATION_EXTENSIONS.has(path.posix.extname(basename))
}

export const validateChangesetCloseout = ({
  changedFiles,
  pendingChangesets,
  skipFlags
}) => {
  const uniqueSkipFlags = [...new Set(skipFlags)]
  const allowedSkipFlags = new Set(Object.values(CHANGESET_SKIP_FLAGS))
  const invalidSkipFlags = uniqueSkipFlags.filter(
    (flag) => !allowedSkipFlags.has(flag)
  )

  if (invalidSkipFlags.length > 0) {
    throw new Error(
      `Unsupported Changeset skip flag: ${invalidSkipFlags.join(', ')}`
    )
  }
  if (uniqueSkipFlags.length > 1) {
    throw new Error('Changeset skip flags are mutually exclusive')
  }

  if (pendingChangesets.length > 0) {
    return Object.freeze({
      mode: 'changeset',
      records: Object.freeze([...pendingChangesets].sort())
    })
  }

  const [skipFlag] = uniqueSkipFlags
  if (skipFlag === CHANGESET_SKIP_FLAGS.DOCS_ONLY) {
    const nonDocumentationFiles = changedFiles.filter(
      (filePath) => !isDocumentationFile(filePath)
    )
    if (nonDocumentationFiles.length > 0) {
      throw new Error(
        `The docs-only flag requires a documentation-only diff; found ${nonDocumentationFiles.join(
          ', '
        )}`
      )
    }
    return Object.freeze({ mode: 'skip', flag: skipFlag })
  }

  if (skipFlag === CHANGESET_SKIP_FLAGS.HOTFIX) {
    return Object.freeze({ mode: 'skip', flag: skipFlag })
  }

  throw new Error(
    'PR closeout requires a pending Changeset or one authorized Changeset skip flag'
  )
}

const normalizeSkipFlag = (value) => {
  if (value === 'docs-only') return CHANGESET_SKIP_FLAGS.DOCS_ONLY
  if (value === 'hotfix') return CHANGESET_SKIP_FLAGS.HOTFIX
  return value
}

export const parseArguments = (args) => {
  let baseRef
  const skipFlags = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--base') {
      baseRef = args[index + 1]
      if (!baseRef || baseRef.startsWith('--')) {
        throw new Error('--base requires a Git ref or commit')
      }
      index += 1
      continue
    }
    if (arg.startsWith('--base=')) {
      baseRef = arg.slice('--base='.length)
      continue
    }
    if (arg === '--skip') {
      const skipFlag = args[index + 1]
      if (!skipFlag || skipFlag.startsWith('--')) {
        throw new Error('--skip requires docs-only or hotfix')
      }
      skipFlags.push(normalizeSkipFlag(skipFlag))
      index += 1
      continue
    }
    if (arg.startsWith('--skip=')) {
      skipFlags.push(normalizeSkipFlag(arg.slice('--skip='.length)))
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!baseRef) throw new Error('--base is required')
  return Object.freeze({ baseRef, skipFlags: Object.freeze(skipFlags) })
}

const readChangedFiles = ({ repositoryRoot, baseRef }) => {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMRTUXBD', `${baseRef}...HEAD`],
    { cwd: repositoryRoot, encoding: 'utf8' }
  )
  return output
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const readCiSkipFlags = (environment) => {
  const skipFlags = []
  if (environment.CHANGESET_SKIP_DOCS_ONLY === 'true') {
    skipFlags.push(CHANGESET_SKIP_FLAGS.DOCS_ONLY)
  }
  if (environment.CHANGESET_SKIP_HOTFIX === 'true') {
    skipFlags.push(CHANGESET_SKIP_FLAGS.HOTFIX)
  }
  return skipFlags
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
  )

  try {
    const { baseRef, skipFlags: argumentSkipFlags } = parseArguments(
      process.argv.slice(2)
    )
    const changedFiles = readChangedFiles({ repositoryRoot, baseRef })
    const pendingChangesets = changedFiles
      .filter(isChangesetRecord)
      .filter((filePath) => fs.existsSync(path.join(repositoryRoot, filePath)))
      .map((filePath) => path.posix.basename(filePath))
    const skipFlags = [...argumentSkipFlags, ...readCiSkipFlags(process.env)]
    const result = validateChangesetCloseout({
      changedFiles,
      pendingChangesets,
      skipFlags
    })

    if (result.mode === 'changeset') {
      process.stdout.write(
        `Changeset closeout passed: ${result.records.join(', ')}\n`
      )
    } else {
      process.stdout.write(
        `Changeset closeout passed with authorized flag: ${result.flag}\n`
      )
    }
  } catch (error) {
    process.stderr.write(`Changeset closeout failed: ${error.message}\n`)
    process.exitCode = 1
  }
}
