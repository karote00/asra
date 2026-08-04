#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readFrameworkReleaseSource } from './framework-release-packages.js'

export const DEFAULT_RELEASE_ARTIFACT_DIRECTORY =
  'tmp/framework-release-artifacts'

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  Object.values(value).forEach(freeze)
  return value
}

export const resolveReleaseArtifactDirectory = ({
  repositoryRoot,
  artifactDirectory = DEFAULT_RELEASE_ARTIFACT_DIRECTORY
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const temporaryRoot = path.join(resolvedRoot, 'tmp')
  const resolvedArtifactDirectory = path.resolve(
    resolvedRoot,
    artifactDirectory
  )

  if (
    path.dirname(resolvedArtifactDirectory) !== temporaryRoot ||
    path.basename(resolvedArtifactDirectory).length === 0
  ) {
    throw new Error(
      `Release artifact directory must be a direct child of project tmp: ${resolvedArtifactDirectory}`
    )
  }

  return resolvedArtifactDirectory
}

const tarballNameFor = ({ name, version }) =>
  `${name.slice(1).replace('/', '-')}-${version}.tgz`

export const createReleasePackageArtifactPlan = ({
  repositoryRoot,
  artifactDirectory = DEFAULT_RELEASE_ARTIFACT_DIRECTORY
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const resolvedArtifactDirectory = resolveReleaseArtifactDirectory({
    repositoryRoot: resolvedRoot,
    artifactDirectory
  })
  const source = readFrameworkReleaseSource({
    repositoryRoot: resolvedRoot
  })

  return freeze(
    source.packages.map((record) => ({
      packageName: record.name,
      version: record.version,
      workspaceDirectory: `packages/${record.directory}`,
      tarballPath: path.join(resolvedArtifactDirectory, tarballNameFor(record))
    }))
  )
}

const runCommandDefault = (command, args, options) => {
  execFileSync(command, args, {
    cwd: options.cwd,
    stdio: 'inherit'
  })
}

export const packFrameworkReleasePackages = ({
  repositoryRoot,
  artifactDirectory = DEFAULT_RELEASE_ARTIFACT_DIRECTORY,
  prebuilt = false,
  runCommand = runCommandDefault
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const resolvedArtifactDirectory = resolveReleaseArtifactDirectory({
    repositoryRoot: resolvedRoot,
    artifactDirectory
  })
  const plan = createReleasePackageArtifactPlan({
    repositoryRoot: resolvedRoot,
    artifactDirectory: resolvedArtifactDirectory
  })

  fs.rmSync(resolvedArtifactDirectory, { recursive: true, force: true })
  fs.mkdirSync(resolvedArtifactDirectory, { recursive: true })

  try {
    if (!prebuilt) {
      runCommand('yarn', ['react:build'], { cwd: resolvedRoot })
    }

    for (const record of plan) {
      runCommand(
        'yarn',
        ['workspace', record.packageName, 'pack', '--out', record.tarballPath],
        { cwd: resolvedRoot }
      )

      if (!fs.existsSync(record.tarballPath)) {
        throw new Error(
          `${record.packageName} did not create ${record.tarballPath}`
        )
      }
    }
  } catch (error) {
    fs.rmSync(resolvedArtifactDirectory, { recursive: true, force: true })
    throw error
  }

  return freeze({
    artifactDirectory: resolvedArtifactDirectory,
    packages: plan
  })
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
  )
  let artifactDirectory = DEFAULT_RELEASE_ARTIFACT_DIRECTORY
  let prebuilt = false
  let printPlan = false

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--out=')) artifactDirectory = arg.slice('--out='.length)
    else if (arg === '--prebuilt') prebuilt = true
    else if (arg === '--plan') printPlan = true
    else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (printPlan) {
    process.stdout.write(
      `${JSON.stringify(
        createReleasePackageArtifactPlan({
          repositoryRoot,
          artifactDirectory
        }),
        null,
        2
      )}\n`
    )
  } else {
    const result = packFrameworkReleasePackages({
      repositoryRoot,
      artifactDirectory,
      prebuilt
    })
    process.stdout.write(
      `Packed ${result.packages.length} framework packages into ${result.artifactDirectory}\n`
    )
  }
}
