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

const tarballEntries = (tarballPath) =>
  execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)

const tarballText = (tarballPath, entryPath) =>
  execFileSync('tar', ['-xOf', tarballPath, entryPath], {
    encoding: 'utf8'
  })

const exportedPaths = (exportsValue) => {
  if (typeof exportsValue === 'string') return [exportsValue]
  if (!exportsValue || typeof exportsValue !== 'object') return []
  return Object.values(exportsValue).flatMap(exportedPaths)
}

const packageEntry = (filePath) => `package/${filePath.replace(/^\.\//, '')}`

const workspaceProtocolPattern = /workspace:|(?:file|link|portal|patch):/
const repositoryOnlyEntryPattern =
  /(^|\/)(coverage|\.turbo|__tests__|node_modules|test-results|playwright-report)(\/|$)|\.(test|spec)\./

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
  try {
    execFileSync(command, args, {
      cwd: options.cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (error) {
    const stderr = typeof error.stderr === 'string' ? error.stderr.trim() : ''
    throw new Error(
      `${command} ${args.join(' ')} failed${stderr ? `: ${stderr}` : ''}`,
      { cause: error }
    )
  }
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

export const validateFrameworkReleasePackageArtifacts = ({
  repositoryRoot,
  artifactDirectory = DEFAULT_RELEASE_ARTIFACT_DIRECTORY
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
  const plannedTarballs = new Set(
    plan.map((record) => path.basename(record.tarballPath))
  )
  const actualTarballs = fs
    .readdirSync(resolvedArtifactDirectory)
    .filter((name) => name.endsWith('.tgz'))
    .sort()

  if (
    actualTarballs.length !== plannedTarballs.size ||
    actualTarballs.some((name) => !plannedTarballs.has(name))
  ) {
    throw new Error(
      `Release artifact set mismatch: expected=${[...plannedTarballs]
        .sort()
        .join(',')} actual=${actualTarballs.join(',')}`
    )
  }

  const rootLicense = fs
    .readFileSync(path.join(resolvedRoot, 'LICENSE'), 'utf8')
    .trim()
  const packageVersions = new Map(
    plan.map((record) => [record.packageName, record.version])
  )
  const packages = plan.map((record) => {
    if (!fs.existsSync(record.tarballPath)) {
      throw new Error(`${record.packageName} tarball is missing`)
    }

    const entries = tarballEntries(record.tarballPath)
    const manifest = JSON.parse(
      tarballText(record.tarballPath, 'package/package.json')
    )
    const serializedManifest = JSON.stringify(manifest)
    const publicPaths = [
      manifest.main,
      manifest.module,
      manifest.types,
      ...exportedPaths(manifest.exports)
    ].filter(Boolean)

    if (
      manifest.name !== record.packageName ||
      manifest.version !== record.version
    ) {
      throw new Error(
        `${record.packageName} packed identity does not match the release plan`
      )
    }
    if (
      manifest.license !== 'MIT' ||
      manifest.type !== 'module' ||
      manifest.engines?.node !== '20.x'
    ) {
      throw new Error(`${record.packageName} packed metadata is incomplete`)
    }
    if (workspaceProtocolPattern.test(serializedManifest)) {
      throw new Error(
        `${record.packageName} contains a workspace-only dependency`
      )
    }
    if (entries.some((entry) => repositoryOnlyEntryPattern.test(entry))) {
      throw new Error(
        `${record.packageName} contains a repository-only artifact`
      )
    }
    if (!entries.includes('package/LICENSE')) {
      throw new Error(`${record.packageName} is missing LICENSE`)
    }
    if (
      tarballText(record.tarballPath, 'package/LICENSE').trim() !== rootLicense
    ) {
      throw new Error(`${record.packageName} LICENSE differs from root LICENSE`)
    }
    for (const publicPath of publicPaths) {
      if (!entries.includes(packageEntry(publicPath))) {
        throw new Error(
          `${record.packageName} public entrypoint does not resolve: ${publicPath}`
        )
      }
    }

    const dependencyFields = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.peerDependencies ?? {})
    }
    for (const [dependencyName, range] of Object.entries(dependencyFields)) {
      const expectedVersion = packageVersions.get(dependencyName)
      if (expectedVersion && range !== expectedVersion) {
        throw new Error(
          `${record.packageName} internal dependency ${dependencyName} must resolve to ${expectedVersion}, found ${range}`
        )
      }
    }

    for (const entry of entries.filter((name) => name.endsWith('.js'))) {
      const source = tarballText(record.tarballPath, entry)
      const sourceMap = source.match(/\/\/# sourceMappingURL=(.+)$/m)?.[1]
      if (
        sourceMap &&
        !entries.includes(path.posix.join(path.posix.dirname(entry), sourceMap))
      ) {
        throw new Error(
          `${record.packageName} source map does not resolve for ${entry}`
        )
      }
    }

    return {
      packageName: record.packageName,
      version: record.version,
      tarballPath: record.tarballPath,
      fileCount: entries.length,
      publicPaths: [...new Set(publicPaths)].sort(),
      internalDependencies: Object.keys(dependencyFields)
        .filter((name) => packageVersions.has(name))
        .sort()
    }
  })

  return freeze({
    artifactDirectory: resolvedArtifactDirectory,
    packages
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
    const packed = packFrameworkReleasePackages({
      repositoryRoot,
      artifactDirectory,
      prebuilt
    })
    const validated = validateFrameworkReleasePackageArtifacts({
      repositoryRoot,
      artifactDirectory
    })
    process.stdout.write(
      `Packed and validated ${validated.packages.length} framework packages into ${packed.artifactDirectory}\n`
    )
  }
}
