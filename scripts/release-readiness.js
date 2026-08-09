#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_RELEASE_ARTIFACT_DIRECTORY,
  validateFrameworkReleasePackageArtifacts
} from './release-package-artifacts.js'
import { readFrameworkReleaseSource } from './framework-release-packages.js'

export const DEFAULT_CLEAN_CONSUMER_DIRECTORY = 'tmp/framework-release-consumer'
export const DEFAULT_REGISTRY_CONSUMER_DIRECTORY =
  'tmp/framework-registry-consumer'
export const DEFAULT_RELEASE_EVIDENCE_DIRECTORY =
  'tmp/framework-release-evidence'

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  Object.values(value).forEach(freeze)
  return value
}

const resolveProjectTemporaryChild = ({ repositoryRoot, target, label }) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const temporaryRoot = path.join(resolvedRoot, 'tmp')
  const resolvedTarget = path.resolve(resolvedRoot, target)
  if (
    path.dirname(resolvedTarget) !== temporaryRoot ||
    path.basename(resolvedTarget).length === 0
  ) {
    throw new Error(
      `${label} must be a direct child of project tmp: ${resolvedTarget}`
    )
  }
  return resolvedTarget
}

export const resolveCleanConsumerDirectory = ({
  repositoryRoot,
  consumerDirectory = DEFAULT_CLEAN_CONSUMER_DIRECTORY
}) =>
  resolveProjectTemporaryChild({
    repositoryRoot,
    target: consumerDirectory,
    label: 'Clean consumer directory'
  })

const fixtureDirectoryFor = (repositoryRoot) =>
  path.join(repositoryRoot, 'fixtures', 'framework-release-consumer')

const readFixtureManifest = (repositoryRoot) =>
  JSON.parse(
    fs.readFileSync(
      path.join(fixtureDirectoryFor(repositoryRoot), 'package.json'),
      'utf8'
    )
  )

const assertFrameworkPackageSet = ({
  declaredPackages,
  expectedPackages,
  label
}) => {
  const declared = [...declaredPackages].sort()
  const expected = [...expectedPackages].sort()
  if (
    declared.length !== expected.length ||
    declared.some((name, index) => name !== expected[index])
  ) {
    throw new Error(
      `${label} package set mismatch: fixture=${declared.join(',')} expected=${expected.join(',')}`
    )
  }
}

export const createCleanConsumerPackageManifest = ({
  repositoryRoot,
  consumerDirectory = DEFAULT_CLEAN_CONSUMER_DIRECTORY,
  artifactDirectory = DEFAULT_RELEASE_ARTIFACT_DIRECTORY
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const resolvedConsumerDirectory = resolveCleanConsumerDirectory({
    repositoryRoot: resolvedRoot,
    consumerDirectory
  })
  const validated = validateFrameworkReleasePackageArtifacts({
    repositoryRoot: resolvedRoot,
    artifactDirectory
  })
  const fixtureManifest = readFixtureManifest(resolvedRoot)
  const declaredPackages = Object.keys(
    fixtureManifest.dependencies ?? {}
  ).filter((name) => name.startsWith('@asyra/'))
  const validatedPackages = validated.packages.map(
    (record) => record.packageName
  )
  assertFrameworkPackageSet({
    declaredPackages,
    expectedPackages: validatedPackages,
    label: 'Clean consumer'
  })

  const dependencies = { ...fixtureManifest.dependencies }
  const resolutions = {}
  for (const record of validated.packages) {
    const relativeTarball = path
      .relative(resolvedConsumerDirectory, record.tarballPath)
      .split(path.sep)
      .join('/')
    const tarballSpecifier = `file:${relativeTarball}`
    dependencies[record.packageName] = tarballSpecifier
    resolutions[record.packageName] = tarballSpecifier
  }

  return freeze({
    ...fixtureManifest,
    packageManager: 'yarn@4.3.1',
    dependencies,
    resolutions
  })
}

export const createRegistryConsumerPackageManifest = ({ repositoryRoot }) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const releaseSource = readFrameworkReleaseSource({
    repositoryRoot: resolvedRoot
  })
  const fixtureManifest = readFixtureManifest(resolvedRoot)
  const declaredPackages = Object.keys(
    fixtureManifest.dependencies ?? {}
  ).filter((name) => name.startsWith('@asyra/'))
  const expectedPackages = releaseSource.packages.map(({ name }) => name)
  assertFrameworkPackageSet({
    declaredPackages,
    expectedPackages,
    label: 'Registry consumer'
  })

  const dependencies = { ...fixtureManifest.dependencies }
  for (const { name, version } of releaseSource.packages) {
    dependencies[name] = version
  }

  return freeze({
    ...fixtureManifest,
    packageManager: 'yarn@4.3.1',
    dependencies
  })
}

export const prepareCleanConsumer = ({
  repositoryRoot,
  consumerDirectory = DEFAULT_CLEAN_CONSUMER_DIRECTORY,
  artifactDirectory = DEFAULT_RELEASE_ARTIFACT_DIRECTORY
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const resolvedConsumerDirectory = resolveCleanConsumerDirectory({
    repositoryRoot: resolvedRoot,
    consumerDirectory
  })
  const fixtureDirectory = fixtureDirectoryFor(resolvedRoot)
  const manifest = createCleanConsumerPackageManifest({
    repositoryRoot: resolvedRoot,
    consumerDirectory: resolvedConsumerDirectory,
    artifactDirectory
  })

  fs.rmSync(resolvedConsumerDirectory, { recursive: true, force: true })
  fs.cpSync(fixtureDirectory, resolvedConsumerDirectory, {
    recursive: true
  })
  fs.writeFileSync(
    path.join(resolvedConsumerDirectory, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  )
  fs.writeFileSync(path.join(resolvedConsumerDirectory, 'yarn.lock'), '')

  return freeze({
    consumerDirectory: resolvedConsumerDirectory,
    manifest
  })
}

export const prepareRegistryConsumer = ({
  repositoryRoot,
  consumerDirectory = DEFAULT_REGISTRY_CONSUMER_DIRECTORY
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const resolvedConsumerDirectory = resolveCleanConsumerDirectory({
    repositoryRoot: resolvedRoot,
    consumerDirectory
  })
  const fixtureDirectory = fixtureDirectoryFor(resolvedRoot)
  const manifest = createRegistryConsumerPackageManifest({
    repositoryRoot: resolvedRoot
  })

  fs.rmSync(resolvedConsumerDirectory, { recursive: true, force: true })
  fs.cpSync(fixtureDirectory, resolvedConsumerDirectory, {
    recursive: true
  })
  fs.writeFileSync(
    path.join(resolvedConsumerDirectory, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  )
  fs.writeFileSync(path.join(resolvedConsumerDirectory, 'yarn.lock'), '')

  return freeze({
    consumerDirectory: resolvedConsumerDirectory,
    manifest
  })
}

const summarizeFailureOutput = (value) =>
  String(value ?? '')
    .trim()
    .split('\n')
    .slice(-20)
    .join('\n')

const runCommandDefault = (command, args, options) => {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (error) {
    const stdout = summarizeFailureOutput(error.stdout)
    const stderr = summarizeFailureOutput(error.stderr)
    throw new Error(
      [
        `${command} ${args.join(' ')} failed`,
        stdout && `stdout:\n${stdout}`,
        stderr && `stderr:\n${stderr}`
      ]
        .filter(Boolean)
        .join('\n'),
      { cause: error }
    )
  }
}

const assertSupportedRuntime = ({ allowUnsupportedNode }) => {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10)
  if (major !== 24 && !allowUnsupportedNode) {
    throw new Error(
      `Framework release verification requires Node 24.x; current runtime is ${process.version}`
    )
  }
}

const verifyInstalledPackages = ({
  consumerDirectory,
  packageNames,
  expectedVersions,
  registryLockfile
}) => {
  const packages = packageNames.map((packageName) => {
    const packageDirectory = path.join(
      consumerDirectory,
      'node_modules',
      ...packageName.split('/')
    )
    if (!fs.existsSync(packageDirectory)) {
      throw new Error(`${packageName} is missing from the clean consumer`)
    }
    if (fs.lstatSync(packageDirectory).isSymbolicLink()) {
      throw new Error(`${packageName} resolved through a symlink`)
    }
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8')
    )
    const expectedVersion = expectedVersions.get(packageName)
    if (
      !expectedVersion ||
      manifest.name !== packageName ||
      manifest.version !== expectedVersion
    ) {
      throw new Error(`${packageName} installed identity is invalid`)
    }
    if (/workspace:|(?:link|portal|patch):/.test(JSON.stringify(manifest))) {
      throw new Error(`${packageName} retained a workspace-only dependency`)
    }
    const registryEvidence = registryLockfile
      ? readRegistryLockEvidence({
          lockfile: registryLockfile,
          packageName,
          expectedVersion
        })
      : {}
    return {
      name: packageName,
      version: manifest.version,
      ...registryEvidence
    }
  })
  return freeze(packages)
}

const readRegistryLockEvidence = ({
  lockfile,
  packageName,
  expectedVersion
}) => {
  const header = `"${packageName}@npm:${expectedVersion}":`
  const start = lockfile.indexOf(header)
  if (start === -1) {
    throw new Error(
      `${packageName}@${expectedVersion} is missing from the public registry lockfile`
    )
  }
  const end = lockfile.indexOf('\n\n', start)
  const block = lockfile.slice(start, end === -1 ? lockfile.length : end)
  if (!block.includes(`resolution: "${packageName}@npm:${expectedVersion}"`)) {
    throw new Error(
      `${packageName}@${expectedVersion} does not resolve through npm in the lockfile`
    )
  }
  const checksum = block.match(/\n {2}checksum: ([^\n]+)/u)?.[1]?.trim()
  if (!checksum) {
    throw new Error(
      `${packageName}@${expectedVersion} is missing a registry integrity checksum`
    )
  }
  return {
    resolution: 'npm',
    checksum
  }
}

const consumerPhases = Object.freeze([
  ['install', 'yarn', ['install', '--no-immutable']],
  ['typecheck', 'yarn', ['typecheck']],
  ['build', 'yarn', ['build']],
  ['test', 'yarn', ['test']]
])

export const verifyCleanConsumer = ({
  repositoryRoot,
  consumerDirectory = DEFAULT_CLEAN_CONSUMER_DIRECTORY,
  artifactDirectory = DEFAULT_RELEASE_ARTIFACT_DIRECTORY,
  evidenceDirectory = DEFAULT_RELEASE_EVIDENCE_DIRECTORY,
  allowUnsupportedNode = false,
  runCommand = runCommandDefault
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  assertSupportedRuntime({ allowUnsupportedNode })
  const releaseSource = readFrameworkReleaseSource({
    repositoryRoot: resolvedRoot
  })
  const expectedVersions = new Map(
    releaseSource.packages.map((record) => [record.name, record.version])
  )
  const prepared = prepareCleanConsumer({
    repositoryRoot: resolvedRoot,
    consumerDirectory,
    artifactDirectory
  })
  const resolvedEvidenceDirectory = resolveProjectTemporaryChild({
    repositoryRoot: resolvedRoot,
    target: evidenceDirectory,
    label: 'Release evidence directory'
  })
  try {
    const completedPhases = consumerPhases.map(([name, command, args]) => {
      runCommand(command, args, {
        cwd: prepared.consumerDirectory
      })
      return name
    })
    const packageNames = Object.keys(prepared.manifest.dependencies)
      .filter((name) => name.startsWith('@asyra/'))
      .sort()
    const installedPackages = verifyInstalledPackages({
      consumerDirectory: prepared.consumerDirectory,
      packageNames,
      expectedVersions
    })
    const evidence = freeze({
      status: allowUnsupportedNode ? 'DIAGNOSTIC' : 'READY',
      runtime: {
        node: process.version,
        packageManager: 'yarn@4.3.1'
      },
      packages: installedPackages,
      phases: completedPhases
    })
    fs.mkdirSync(resolvedEvidenceDirectory, { recursive: true })
    fs.writeFileSync(
      path.join(resolvedEvidenceDirectory, 'clean-consumer.json'),
      `${JSON.stringify(evidence, null, 2)}\n`
    )
    return evidence
  } finally {
    fs.rmSync(prepared.consumerDirectory, {
      recursive: true,
      force: true
    })
  }
}

export const verifyRegistryConsumer = ({
  repositoryRoot,
  consumerDirectory = DEFAULT_REGISTRY_CONSUMER_DIRECTORY,
  evidenceDirectory = DEFAULT_RELEASE_EVIDENCE_DIRECTORY,
  allowUnsupportedNode = false,
  runCommand = runCommandDefault
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  assertSupportedRuntime({ allowUnsupportedNode })
  const releaseSource = readFrameworkReleaseSource({
    repositoryRoot: resolvedRoot
  })
  const expectedVersions = new Map(
    releaseSource.packages.map((record) => [record.name, record.version])
  )
  const prepared = prepareRegistryConsumer({
    repositoryRoot: resolvedRoot,
    consumerDirectory
  })
  const resolvedEvidenceDirectory = resolveProjectTemporaryChild({
    repositoryRoot: resolvedRoot,
    target: evidenceDirectory,
    label: 'Release evidence directory'
  })

  try {
    const completedPhases = consumerPhases.map(([name, command, args]) => {
      runCommand(command, args, {
        cwd: prepared.consumerDirectory
      })
      return name
    })
    const packageNames = Object.keys(prepared.manifest.dependencies)
      .filter((name) => name.startsWith('@asyra/'))
      .sort()
    const registryLockfile = fs.readFileSync(
      path.join(prepared.consumerDirectory, 'yarn.lock'),
      'utf8'
    )
    const installedPackages = verifyInstalledPackages({
      consumerDirectory: prepared.consumerDirectory,
      packageNames,
      expectedVersions,
      registryLockfile
    })
    const evidence = freeze({
      status: allowUnsupportedNode ? 'DIAGNOSTIC' : 'READY',
      runtime: {
        node: process.version,
        packageManager: 'yarn@4.3.1'
      },
      registry: 'https://registry.npmjs.org',
      packages: installedPackages,
      phases: completedPhases
    })
    fs.mkdirSync(resolvedEvidenceDirectory, { recursive: true })
    fs.writeFileSync(
      path.join(resolvedEvidenceDirectory, 'registry-only-consumer.json'),
      `${JSON.stringify(evidence, null, 2)}\n`
    )
    return evidence
  } finally {
    fs.rmSync(prepared.consumerDirectory, {
      recursive: true,
      force: true
    })
  }
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
  )
  let allowUnsupportedNode = false
  let registryOnly = false
  for (const arg of process.argv.slice(2)) {
    if (arg === '--allow-unsupported-node') allowUnsupportedNode = true
    else if (arg === '--registry') registryOnly = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  const evidence = registryOnly
    ? verifyRegistryConsumer({
        repositoryRoot,
        allowUnsupportedNode
      })
    : verifyCleanConsumer({
        repositoryRoot,
        allowUnsupportedNode
      })
  process.stdout.write(
    `${registryOnly ? 'Registry-only' : 'Clean'} consumer ${evidence.status}: ${evidence.packages.length} packages, ${evidence.phases.length} phases\n`
  )
}
