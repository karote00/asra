#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import { readFrameworkReleaseSource } from './framework-release-packages.js'
import {
  DEFAULT_RELEASE_ARTIFACT_DIRECTORY,
  validateFrameworkReleasePackageArtifacts
} from './release-package-artifacts.js'

export const DEFAULT_TEMPLATE_CONSUMER_DIRECTORY =
  'tmp/framework-release-template-consumer'
export const DEFAULT_TEMPLATE_EVIDENCE_DIRECTORY =
  'tmp/framework-release-evidence'

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value))
    return value
  Object.freeze(value)
  Object.values(value).forEach(freeze)
  return value
}

const resolveTemporaryChild = ({ repositoryRoot, target, label }) => {
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

export const resolveTemplateConsumerDirectory = ({
  repositoryRoot,
  consumerDirectory = DEFAULT_TEMPLATE_CONSUMER_DIRECTORY
}) =>
  resolveTemporaryChild({
    repositoryRoot,
    target: consumerDirectory,
    label: 'Generated template consumer directory'
  })

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const readReleaseConfig = ({ repositoryRoot, appName }) => {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(appName)) {
    throw new Error(`Invalid app name: ${appName}`)
  }
  const configPath = path.join(
    repositoryRoot,
    'release-configs',
    `${appName}.json`
  )
  if (!fs.existsSync(configPath)) {
    throw new Error(`Release config not found: ${configPath}`)
  }
  return readJson(configPath)
}

const packageNameForSpecifier = (specifier) =>
  specifier.split('/').slice(0, 2).join('/')

const exportedSubpathForSpecifier = (specifier) => {
  const packageName = packageNameForSpecifier(specifier)
  const suffix = specifier.slice(packageName.length)
  return suffix.length === 0 ? '.' : `.${suffix}`
}

const sourceExtensions = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx'
])

const collectSourceFiles = (directory) => {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      ['dist', 'node_modules', 'playwright-report', 'test-results'].includes(
        entry.name
      )
    ) {
      continue
    }
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectSourceFiles(entryPath))
    else if (sourceExtensions.has(path.extname(entry.name)))
      files.push(entryPath)
  }
  return files
}

const collectFrameworkImports = (templateDirectory) => {
  const imports = []
  const importPattern =
    /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](@asyra\/[^'"]+)['"]/gu
  for (const filePath of collectSourceFiles(templateDirectory)) {
    const source = fs.readFileSync(filePath, 'utf8')
    for (const match of source.matchAll(importPattern)) {
      imports.push({
        file: path.relative(templateDirectory, filePath),
        specifier: match[1]
      })
    }
  }
  return imports
}

export const validateGeneratedTemplateContract = ({
  repositoryRoot,
  appName
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const config = readReleaseConfig({
    repositoryRoot: resolvedRoot,
    appName
  })
  const templateDirectory = path.resolve(resolvedRoot, config.dest)
  const manifest = readJson(path.join(templateDirectory, 'package.json'))
  const releaseSource = readFrameworkReleaseSource({
    repositoryRoot: resolvedRoot
  })
  const packagesByName = new Map(
    releaseSource.packages.map((record) => [record.name, record])
  )
  const declaredDependencies = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {})
  }
  const serializedManifest = JSON.stringify(manifest)

  if (manifest.engines?.node !== '24.x') {
    throw new Error('Generated template must require Node 24.x')
  }
  if (manifest.packageManager !== 'yarn@4.3.1') {
    throw new Error('Generated template must use Yarn 4.3.1')
  }
  if (/workspace:|(?:link|portal|patch):/.test(serializedManifest)) {
    throw new Error('Generated template contains a workspace-only dependency')
  }
  if (
    /(?:\.\.\/){2}|--cwd\s+\.\.\/\.\./.test(JSON.stringify(manifest.scripts))
  ) {
    throw new Error('Generated template contains a monorepo-only script')
  }

  const imports = collectFrameworkImports(templateDirectory)
  for (const record of imports) {
    const packageName = packageNameForSpecifier(record.specifier)
    const releasePackage = packagesByName.get(packageName)
    if (!releasePackage) {
      throw new Error(
        `${record.file} imports a package outside the release set: ${record.specifier}`
      )
    }
    if (!declaredDependencies[packageName]) {
      throw new Error(
        `${record.file} imports an undeclared package: ${record.specifier}`
      )
    }
    const subpath = exportedSubpathForSpecifier(record.specifier)
    if (!Object.hasOwn(releasePackage.exports, subpath)) {
      throw new Error(
        `${record.file} imports a non-public package path: ${record.specifier}`
      )
    }
  }

  for (const [packageName, version] of Object.entries(declaredDependencies)) {
    const releasePackage = packagesByName.get(packageName)
    if (releasePackage && version !== releasePackage.version) {
      throw new Error(
        `${packageName} must use frozen version ${releasePackage.version}, found ${version}`
      )
    }
  }

  const packageNames = Object.keys(declaredDependencies)
    .filter((packageName) => packagesByName.has(packageName))
    .sort()

  return freeze({
    appName,
    importCount: imports.length,
    importedPackageNames: [
      ...new Set(
        imports.map(({ specifier }) => packageNameForSpecifier(specifier))
      )
    ].sort(),
    packageNames,
    packageVersions: Object.fromEntries(
      packageNames.map((packageName) => [
        packageName,
        packagesByName.get(packageName).version
      ])
    ),
    templateDirectory
  })
}

export const prepareGeneratedTemplateConsumer = ({
  repositoryRoot,
  appName,
  consumerDirectory = DEFAULT_TEMPLATE_CONSUMER_DIRECTORY,
  artifactDirectory = DEFAULT_RELEASE_ARTIFACT_DIRECTORY
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const contract = validateGeneratedTemplateContract({
    repositoryRoot: resolvedRoot,
    appName
  })
  const resolvedConsumerDirectory = resolveTemplateConsumerDirectory({
    repositoryRoot: resolvedRoot,
    consumerDirectory
  })
  const artifacts = validateFrameworkReleasePackageArtifacts({
    repositoryRoot: resolvedRoot,
    artifactDirectory
  })
  const manifest = readJson(
    path.join(contract.templateDirectory, 'package.json')
  )
  const resolutions = {}

  for (const artifact of artifacts.packages) {
    const relativeTarball = path
      .relative(resolvedConsumerDirectory, artifact.tarballPath)
      .split(path.sep)
      .join('/')
    const specifier = `file:${relativeTarball}`
    resolutions[artifact.packageName] = specifier
    if (manifest.dependencies?.[artifact.packageName]) {
      manifest.dependencies[artifact.packageName] = specifier
    }
    if (manifest.devDependencies?.[artifact.packageName]) {
      manifest.devDependencies[artifact.packageName] = specifier
    }
  }
  manifest.resolutions = resolutions

  fs.rmSync(resolvedConsumerDirectory, { recursive: true, force: true })
  fs.cpSync(contract.templateDirectory, resolvedConsumerDirectory, {
    recursive: true
  })
  fs.writeFileSync(
    path.join(resolvedConsumerDirectory, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  )
  fs.writeFileSync(
    path.join(resolvedConsumerDirectory, '.yarnrc.yml'),
    'nodeLinker: node-modules\nenableTransparentWorkspaces: false\n'
  )
  fs.writeFileSync(path.join(resolvedConsumerDirectory, 'yarn.lock'), '')

  return freeze({
    consumerDirectory: resolvedConsumerDirectory,
    contract,
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
      env: { ...process.env, CI: '1', ...options.env },
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

const verifyInstalledPackages = ({ consumerDirectory, packageVersions }) => {
  for (const [packageName, expectedVersion] of Object.entries(
    packageVersions
  )) {
    const packageDirectory = path.join(
      consumerDirectory,
      'node_modules',
      ...packageName.split('/')
    )
    if (!fs.existsSync(packageDirectory)) {
      throw new Error(`${packageName} is missing from the template consumer`)
    }
    if (fs.lstatSync(packageDirectory).isSymbolicLink()) {
      throw new Error(`${packageName} resolved through a symlink`)
    }
    const manifest = readJson(path.join(packageDirectory, 'package.json'))
    if (manifest.name !== packageName || manifest.version !== expectedVersion) {
      throw new Error(`${packageName} installed identity is invalid`)
    }
  }
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
  return checksum
}

export const validateRegistryInstalledGeneratedApp = ({
  repositoryRoot,
  appName,
  generatedAppDirectory
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const resolvedGeneratedApp = path.resolve(generatedAppDirectory)
  const relativeGeneratedApp = path.relative(resolvedRoot, resolvedGeneratedApp)
  if (
    relativeGeneratedApp.startsWith('..') ||
    path.isAbsolute(relativeGeneratedApp) ||
    relativeGeneratedApp.split(path.sep)[0] !== 'tmp'
  ) {
    throw new Error(
      `Registry-installed generated app must remain inside project tmp: ${resolvedGeneratedApp}`
    )
  }

  const contract = validateGeneratedTemplateContract({
    repositoryRoot: resolvedRoot,
    appName
  })
  const expectedManifest = readJson(
    path.join(contract.templateDirectory, 'package.json')
  )
  const manifest = readJson(path.join(resolvedGeneratedApp, 'package.json'))
  if (!isDeepStrictEqual(manifest, expectedManifest)) {
    throw new Error(
      'Generated app does not preserve the verified public registry dependency contract'
    )
  }
  if (manifest.resolutions !== undefined) {
    throw new Error(
      'Generated app public registry dependency contract must not use resolutions'
    )
  }

  const declaredDependencies = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {})
  }
  const lockfile = fs.readFileSync(
    path.join(resolvedGeneratedApp, 'yarn.lock'),
    'utf8'
  )
  const packages = contract.packageNames.map((name) => {
    const version = contract.packageVersions[name]
    if (declaredDependencies[name] !== version) {
      throw new Error(
        `${name} violates the public registry dependency contract: expected ${version}, found ${declaredDependencies[name]}`
      )
    }
    const checksum = readRegistryLockEvidence({
      lockfile,
      packageName: name,
      expectedVersion: version
    })
    const installedPath = path.join(
      resolvedGeneratedApp,
      'node_modules',
      ...name.split('/')
    )
    if (!fs.existsSync(installedPath)) {
      throw new Error(`${name} is missing from the registry-installed app`)
    }
    if (fs.lstatSync(installedPath).isSymbolicLink()) {
      throw new Error(`${name} resolved through a symlink instead of npm`)
    }
    const installedManifest = readJson(path.join(installedPath, 'package.json'))
    if (
      installedManifest.name !== name ||
      installedManifest.version !== version
    ) {
      throw new Error(
        `${name} installed metadata does not match ${name}@${version}`
      )
    }
    const relativeInstalledPath = path.relative(
      path.join(resolvedGeneratedApp, 'node_modules'),
      fs.realpathSync(installedPath)
    )
    if (
      relativeInstalledPath.startsWith('..') ||
      path.isAbsolute(relativeInstalledPath)
    ) {
      throw new Error(`${name} resolves outside the generated app`)
    }
    return freeze({
      name,
      version,
      resolution: 'npm',
      checksum,
      installedPath
    })
  })

  return freeze({
    appName,
    generatedAppDirectory: resolvedGeneratedApp,
    packages
  })
}

const allocatePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Unable to allocate generated-template smoke port'))
        return
      }
      server.close((error) => {
        if (error) reject(error)
        else resolve(address.port)
      })
    })
  })

const runStartupSmokeDefault = async ({ consumerDirectory }) => {
  const port = await allocatePort()
  const child = spawn(
    'yarn',
    [
      'vite',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort'
    ],
    {
      cwd: consumerDirectory,
      env: {
        ...process.env,
        APP_URL: `http://127.0.0.1:${port}`,
        CI: '1',
        VITE_COLLABORATION_WS_URL: ' '
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )
  const output = []
  child.stdout.on('data', (chunk) => output.push(String(chunk)))
  child.stderr.on('data', (chunk) => output.push(String(chunk)))

  try {
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(
          `Generated-template preview exited early:\n${summarizeFailureOutput(
            output.join('')
          )}`
        )
      }
      try {
        const response = await globalThis.fetch(`http://127.0.0.1:${port}/`)
        if (response.ok && (await response.text()).includes('id="root"')) {
          return
        }
      } catch {
        // Preview startup is polled until the bounded deadline.
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('Generated-template preview did not become ready')
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM')
    await new Promise((resolve) => {
      if (child.exitCode !== null) resolve()
      else child.once('exit', resolve)
    })
  }
}

export const verifyGeneratedTemplate = async ({
  repositoryRoot,
  appName,
  consumerDirectory = DEFAULT_TEMPLATE_CONSUMER_DIRECTORY,
  artifactDirectory = DEFAULT_RELEASE_ARTIFACT_DIRECTORY,
  evidenceDirectory = DEFAULT_TEMPLATE_EVIDENCE_DIRECTORY,
  allowUnsupportedNode = false,
  runCommand = runCommandDefault,
  runStartupSmoke = runStartupSmokeDefault
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  assertSupportedRuntime({ allowUnsupportedNode })
  const prepared = prepareGeneratedTemplateConsumer({
    repositoryRoot: resolvedRoot,
    appName,
    consumerDirectory,
    artifactDirectory
  })
  const resolvedEvidenceDirectory = resolveTemporaryChild({
    repositoryRoot: resolvedRoot,
    target: evidenceDirectory,
    label: 'Generated template evidence directory'
  })
  const phases = [
    ['install', 'yarn', ['install', '--no-immutable']],
    ['build', 'yarn', ['react:build']],
    ['test', 'yarn', ['test']]
  ]

  try {
    const completedPhases = []
    for (const [phase, command, args] of phases) {
      runCommand(command, args, {
        cwd: prepared.consumerDirectory,
        env: {
          APP_URL: 'http://127.0.0.1:4173',
          VITE_COLLABORATION_WS_URL: ' '
        }
      })
      completedPhases.push(phase)
    }
    verifyInstalledPackages({
      consumerDirectory: prepared.consumerDirectory,
      packageVersions: prepared.contract.packageVersions
    })
    await runStartupSmoke({
      consumerDirectory: prepared.consumerDirectory
    })
    completedPhases.push('startup-smoke')

    const evidence = freeze({
      status: allowUnsupportedNode ? 'DIAGNOSTIC' : 'READY',
      runtime: {
        node: process.version,
        packageManager: 'yarn@4.3.1'
      },
      appName,
      importCount: prepared.contract.importCount,
      packages: prepared.contract.packageNames,
      phases: completedPhases
    })
    fs.mkdirSync(resolvedEvidenceDirectory, { recursive: true })
    fs.writeFileSync(
      path.join(resolvedEvidenceDirectory, 'generated-template.json'),
      `${JSON.stringify(evidence, null, 2)}\n`
    )
    return evidence
  } finally {
    fs.rmSync(prepared.consumerDirectory, { recursive: true, force: true })
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
  let appName
  let allowUnsupportedNode = false
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--prod=')) appName = arg.slice('--prod='.length)
    else if (arg === '--allow-unsupported-node') allowUnsupportedNode = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!appName) throw new Error('Must specify --prod=<app-name>')

  const evidence = await verifyGeneratedTemplate({
    repositoryRoot,
    appName,
    allowUnsupportedNode
  })
  process.stdout.write(
    `Generated template ${evidence.status}: ${evidence.packages.length} packages, ${evidence.phases.length} phases\n`
  )
}
