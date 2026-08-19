#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_WORK_DIRECTORY = 'tmp/minimal-create-app-release'
const packageManagers = ['yarn', 'npm', 'pnpm']
const templateEntries = [
  '.env',
  '.gitignore',
  '.prettierrc',
  'AGENTS.md',
  'LICENSE',
  'README.md',
  '__tests__',
  'docs',
  'e2e',
  'eslint.config.js',
  'index.html',
  'package.json',
  'playwright.config.ts',
  'src',
  'tsconfig.json',
  'vite.config.ts'
]
const consumerPackageManagers = {
  npm: 'npm@10.8.2',
  pnpm: 'pnpm@9.15.0',
  yarn: 'yarn@4.3.1'
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

export const resolveCreateAppReleasePath = ({
  repositoryRoot,
  target = DEFAULT_WORK_DIRECTORY,
  label
}) => {
  const resolvedRoot = path.resolve(repositoryRoot)
  const resolvedTarget = path.resolve(resolvedRoot, target)
  if (
    path.dirname(resolvedTarget) !== path.join(resolvedRoot, 'tmp') ||
    path.basename(resolvedTarget).length === 0
  ) {
    throw new Error(
      `${label} must be a direct child of project tmp: ${resolvedTarget}`
    )
  }
  return resolvedTarget
}

export const inspectCreateAppReleaseSource = ({ repositoryRoot }) => {
  const repositoryName = readJson(
    path.join(repositoryRoot, 'package.json')
  ).name
  const packageDirectory = path.join(
    repositoryRoot,
    'create-app',
    repositoryName
  )
  const templateDirectory = path.join(packageDirectory, 'template')
  const manifest = readJson(path.join(packageDirectory, 'package.json'))
  const templateManifest = readJson(
    path.join(templateDirectory, 'package.json')
  )
  const actualTemplateEntries = fs.readdirSync(templateDirectory).sort()
  const actualSourceFiles = fs
    .readdirSync(path.join(templateDirectory, 'src'))
    .sort()

  if (
    JSON.stringify(actualTemplateEntries) !== JSON.stringify(templateEntries)
  ) {
    throw new Error(
      `create-asyra-app template entries are not minimal: ${actualTemplateEntries.join(', ')}`
    )
  }

  return Object.freeze({
    bin: manifest.bin,
    name: manifest.name,
    publishedRoots: [...manifest.files].sort(),
    runtimeDependencies: Object.keys(manifest.dependencies ?? {}).sort(),
    templateDependencies: Object.keys(
      templateManifest.dependencies ?? {}
    ).sort(),
    templateSourceFiles: actualSourceFiles,
    version: manifest.version
  })
}

const commandsFor = (packageManager, packageSpecifier) => {
  if (packageManager === 'yarn') {
    return {
      install: ['yarn', ['add', '--dev', packageSpecifier]],
      generate: [
        'yarn',
        ['create-asyra', 'generated-app', '--package-manager=yarn']
      ]
    }
  }
  if (packageManager === 'npm') {
    return {
      install: ['npm', ['install', '--save-dev', packageSpecifier]],
      generate: [
        'npx',
        [
          '--no-install',
          'create-asyra',
          'generated-app',
          '--package-manager=npm'
        ]
      ]
    }
  }
  return {
    install: ['pnpm', ['add', '--save-dev', packageSpecifier]],
    generate: [
      'pnpm',
      ['exec', 'create-asyra', 'generated-app', '--package-manager=pnpm']
    ]
  }
}

export const createCreateAppConsumerPlan = ({
  repositoryRoot,
  mode = 'local',
  workDirectory = DEFAULT_WORK_DIRECTORY,
  selectedPackageManagers = packageManagers
}) => {
  const source = inspectCreateAppReleaseSource({ repositoryRoot })
  const resolvedWorkDirectory = resolveCreateAppReleasePath({
    repositoryRoot,
    target: workDirectory,
    label: 'Create-app release directory'
  })
  const tarballPath = path.join(
    resolvedWorkDirectory,
    `${source.name}-${source.version}.tgz`
  )
  if (mode !== 'local' && mode !== 'registry') {
    throw new Error(`Unknown create-app release mode: ${mode}`)
  }
  const packageSpecifier =
    mode === 'registry' ? `${source.name}@${source.version}` : tarballPath

  return selectedPackageManagers.map((packageManager) => {
    if (!packageManagers.includes(packageManager)) {
      throw new Error(`Unsupported package manager: ${packageManager}`)
    }
    const commands = commandsFor(packageManager, packageSpecifier)
    return Object.freeze({
      consumerDirectory: path.join(resolvedWorkDirectory, packageManager),
      generateCommand: commands.generate,
      generatedCommands: ['test', 'typecheck', 'react:build'].map((script) => ({
        command:
          packageManager === 'npm'
            ? ['npm', ['run', script]]
            : [packageManager, ['run', script]],
        script
      })),
      installCommand: commands.install,
      packageManager,
      packageSpecifier,
      projectName: 'generated-app',
      tarballPath
    })
  })
}

const runCommandDefault = (command, args, { cwd }) =>
  execFileSync(command, args, { cwd, stdio: 'inherit' })

const validateTarball = ({ source, tarballPath }) => {
  const entries = execFileSync('tar', ['-tzf', tarballPath], {
    encoding: 'utf8'
  })
    .trim()
    .split('\n')
    .filter(Boolean)
  const normalized = entries.map((entry) => entry.replace(/^package\//u, ''))
  const forbidden = normalized.filter((entry) =>
    /(^|\/)(node_modules|dist|coverage|test-results|playwright-report|server)(\/|$)|(^|\/)yarn\.lock$|(^|\/)package-lock\.json$|(^|\/)pnpm-lock\.yaml$/u.test(
      entry
    )
  )
  if (forbidden.length > 0) {
    throw new Error(`Packed create-app contains forbidden files: ${forbidden}`)
  }
  for (const required of [
    'package.json',
    'bin/index.js',
    'template/AGENTS.md',
    'template/docs/framework.md',
    'template/src/App.tsx'
  ]) {
    if (!normalized.includes(required)) {
      throw new Error(`Packed create-app is missing ${required}`)
    }
  }
  const packedManifest = JSON.parse(
    execFileSync('tar', ['-xOf', tarballPath, 'package/package.json'], {
      encoding: 'utf8'
    })
  )
  if (
    packedManifest.name !== source.name ||
    packedManifest.version !== source.version
  ) {
    throw new Error('Packed create-app identity does not match its source')
  }
  return entries.length
}

export const verifyCreateAppRelease = ({
  repositoryRoot,
  mode = 'local',
  workDirectory = DEFAULT_WORK_DIRECTORY,
  selectedPackageManagers = packageManagers,
  runCommand = runCommandDefault
}) => {
  const source = inspectCreateAppReleaseSource({ repositoryRoot })
  const plan = createCreateAppConsumerPlan({
    repositoryRoot,
    mode,
    workDirectory,
    selectedPackageManagers
  })
  const resolvedWorkDirectory = path.dirname(plan[0].consumerDirectory)
  const tarballPath = plan[0].tarballPath

  fs.rmSync(resolvedWorkDirectory, { recursive: true, force: true })
  fs.mkdirSync(resolvedWorkDirectory, { recursive: true })
  let entryCount = 0
  if (mode === 'local') {
    runCommand(
      'yarn',
      ['workspace', source.name, 'pack', '--out', tarballPath],
      { cwd: repositoryRoot }
    )
    entryCount = validateTarball({ source, tarballPath })
  }

  for (const consumer of plan) {
    fs.mkdirSync(consumer.consumerDirectory, { recursive: true })
    fs.writeFileSync(
      path.join(consumer.consumerDirectory, 'package.json'),
      `${JSON.stringify({
        name: `minimal-create-${consumer.packageManager}-consumer`,
        packageManager: consumerPackageManagers[consumer.packageManager],
        private: true
      })}\n`
    )
    if (consumer.packageManager === 'yarn') {
      fs.writeFileSync(
        path.join(consumer.consumerDirectory, '.yarnrc.yml'),
        'nodeLinker: node-modules\nenableTransparentWorkspaces: false\n'
      )
      fs.writeFileSync(path.join(consumer.consumerDirectory, 'yarn.lock'), '')
    }
    runCommand(...consumer.installCommand, { cwd: consumer.consumerDirectory })
    const installedManifest = readJson(
      path.join(
        consumer.consumerDirectory,
        'node_modules',
        source.name,
        'package.json'
      )
    )
    if (
      installedManifest.name !== source.name ||
      installedManifest.version !== source.version
    ) {
      throw new Error(
        `${consumer.packageManager} installed the wrong create-app identity`
      )
    }
    runCommand(...consumer.generateCommand, { cwd: consumer.consumerDirectory })
    const generatedDirectory = path.join(
      consumer.consumerDirectory,
      consumer.projectName
    )
    for (const record of consumer.generatedCommands) {
      runCommand(...record.command, { cwd: generatedDirectory })
    }
    fs.rmSync(consumer.consumerDirectory, { recursive: true, force: true })
  }

  const checksum =
    mode === 'local'
      ? createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex')
      : undefined
  return Object.freeze({
    checksum,
    entryCount,
    packageManagers: plan.map(({ packageManager }) => packageManager),
    tarballPath: mode === 'local' ? tarballPath : undefined,
    version: source.version
  })
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const selected = process.argv
    .filter((argument) => argument.startsWith('--package-manager='))
    .map((argument) => argument.slice('--package-manager='.length))
  const mode = process.argv.includes('--registry') ? 'registry' : 'local'
  const result = verifyCreateAppRelease({
    repositoryRoot,
    mode,
    selectedPackageManagers: selected.length > 0 ? selected : packageManagers
  })
  console.log(`READY create-asyra-app@${result.version}`)
  if (result.tarballPath) console.log(`Tarball: ${result.tarballPath}`)
  if (result.checksum) console.log(`SHA256: ${result.checksum}`)
  console.log(`Package managers: ${result.packageManagers.join(', ')}`)
}
