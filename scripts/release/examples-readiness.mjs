#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXAMPLE_SOURCES } from '../../docs/examples/run-example.mjs'
import { packFrameworkReleasePackages } from '../release-package-artifacts.js'
import {
  prepareCleanConsumer,
  prepareRegistryConsumer
} from '../release-readiness.js'
import { readApprovedExamplePackageInputs } from './example-package-inputs.mjs'

export const EXAMPLE_IDS = Object.freeze(Object.keys(EXAMPLE_SOURCES))

const DEFAULT_CONSUMER_DIRECTORY = 'tmp/framework-examples-consumer'
const DEFAULT_EVIDENCE_DIRECTORY = 'tmp/framework-examples-evidence'

const runCommandDefault = (command, args, options) => {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd,
      encoding: 'utf8',
      env: { ...process.env, CI: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (error) {
    const tail = [error.stdout, error.stderr]
      .filter((value) => typeof value === 'string' && value.trim())
      .flatMap((value) => value.trim().split('\n').slice(-20))
      .join('\n')
    throw new Error(
      `${command} ${args.join(' ')} failed${tail ? `\n${tail}` : ''}`,
      { cause: error }
    )
  }
}

const resolveTemporaryChild = (repositoryRoot, relativePath, label) => {
  const root = path.resolve(repositoryRoot)
  const resolved = path.resolve(root, relativePath)
  if (
    path.dirname(resolved) !== path.join(root, 'tmp') ||
    !path.basename(resolved)
  ) {
    throw new Error(`${label} must be a direct child of project tmp`)
  }
  return resolved
}

export const createExampleConsumerPlan = ({ mode = 'local' } = {}) => {
  if (mode !== 'local' && mode !== 'registry') {
    throw new Error(`Unknown example consumer mode: ${mode}`)
  }
  return Object.freeze({
    mode,
    sourceDirectories: Object.freeze([
      'docs/examples',
      'apps/asyra-design/examples'
    ]),
    commands: Object.freeze([
      Object.freeze(['yarn', 'install', '--no-immutable']),
      Object.freeze([
        'yarn',
        'tsc',
        '-p',
        'docs/examples/tsconfig.public-consumer.json'
      ]),
      ...EXAMPLE_IDS.map((id) =>
        Object.freeze(['node', 'docs/examples/run-example.mjs', id])
      )
    ])
  })
}

const copyExampleSources = ({ repositoryRoot, consumerDirectory, plan }) => {
  for (const relativeDirectory of plan.sourceDirectories) {
    const source = path.join(repositoryRoot, relativeDirectory)
    const destination = path.join(consumerDirectory, relativeDirectory)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.cpSync(source, destination, { recursive: true })
  }
}

const readRegistryEvidence = ({ lockfile, packageName, version }) => {
  const header = `"${packageName}@npm:${version}":`
  const start = lockfile.indexOf(header)
  if (start === -1) {
    throw new Error(`${packageName}@${version} lacks registry lock evidence`)
  }
  const end = lockfile.indexOf('\n\n', start)
  const block = lockfile.slice(start, end === -1 ? lockfile.length : end)
  if (
    !block.includes(`resolution: "${packageName}@npm:${version}"`) ||
    !/\n {2}checksum: /u.test(block)
  ) {
    throw new Error(`${packageName}@${version} lacks npm integrity evidence`)
  }
  return 'npm'
}

const verifyInstalledPackages = ({
  consumerDirectory,
  packageInputs,
  mode
}) => {
  const lockfile =
    mode === 'registry'
      ? fs.readFileSync(path.join(consumerDirectory, 'yarn.lock'), 'utf8')
      : undefined
  return packageInputs.packages.map(({ name, version }) => {
    const packageDirectory = path.join(
      consumerDirectory,
      'node_modules',
      ...name.split('/')
    )
    if (!fs.existsSync(packageDirectory)) {
      throw new Error(`${name} is missing from the example consumer`)
    }
    if (fs.lstatSync(packageDirectory).isSymbolicLink()) {
      throw new Error(`${name} resolved through a workspace symlink`)
    }
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8')
    )
    if (manifest.name !== name || manifest.version !== version) {
      throw new Error(`${name} installed identity is invalid`)
    }
    if (/workspace:|(?:link|portal|patch):/u.test(JSON.stringify(manifest))) {
      throw new Error(`${name} retained a workspace-only dependency`)
    }
    return Object.freeze({
      name,
      version,
      resolution:
        mode === 'registry'
          ? readRegistryEvidence({ lockfile, packageName: name, version })
          : 'packed-artifact'
    })
  })
}

export const verifyPublicExamples = ({
  repositoryRoot,
  mode = 'local',
  prebuilt = false,
  runCommand = runCommandDefault
}) => {
  const root = path.resolve(repositoryRoot)
  const major = Number.parseInt(process.versions.node.split('.')[0], 10)
  if (major !== 24) {
    throw new Error(
      `Executable examples require Node 24.x, found ${process.version}`
    )
  }
  const plan = createExampleConsumerPlan({ mode })
  const packageInputs = readApprovedExamplePackageInputs({
    repositoryRoot: root
  })
  const consumerDirectory = resolveTemporaryChild(
    root,
    DEFAULT_CONSUMER_DIRECTORY,
    'Example consumer directory'
  )
  const evidenceDirectory = resolveTemporaryChild(
    root,
    DEFAULT_EVIDENCE_DIRECTORY,
    'Example evidence directory'
  )

  if (mode === 'local') {
    packFrameworkReleasePackages({
      repositoryRoot: root,
      prebuilt,
      runCommand
    })
    prepareCleanConsumer({
      repositoryRoot: root,
      consumerDirectory
    })
  } else {
    prepareRegistryConsumer({
      repositoryRoot: root,
      consumerDirectory
    })
  }

  try {
    copyExampleSources({
      repositoryRoot: root,
      consumerDirectory,
      plan
    })
    const [install, typecheck, ...exampleCommands] = plan.commands
    runCommand(install[0], install.slice(1), { cwd: consumerDirectory })
    const packages = verifyInstalledPackages({
      consumerDirectory,
      packageInputs,
      mode
    })
    runCommand(typecheck[0], typecheck.slice(1), { cwd: consumerDirectory })

    const examples = exampleCommands.map(([command, ...args]) => {
      const output = runCommand(command, args, { cwd: consumerDirectory })
      const line = output.trim().split('\n').at(-1)
      const evidence = JSON.parse(line)
      if (evidence.status !== 'passed' || evidence.id !== args.at(-1)) {
        throw new Error(`Example ${args.at(-1)} returned invalid evidence`)
      }
      return evidence
    })
    const evidence = Object.freeze({
      examples,
      mode,
      packages,
      runtime: process.version,
      status: mode === 'registry' ? 'REGISTRY_READY' : 'LOCAL_READY'
    })
    fs.mkdirSync(evidenceDirectory, { recursive: true })
    fs.writeFileSync(
      path.join(evidenceDirectory, `${mode}.json`),
      `${JSON.stringify(evidence, null, 2)}\n`
    )
    return evidence
  } finally {
    fs.rmSync(consumerDirectory, { recursive: true, force: true })
  }
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  let mode = 'local'
  let prebuilt = false
  for (const argument of process.argv.slice(2)) {
    if (argument === '--registry') mode = 'registry'
    else if (argument === '--prebuilt') prebuilt = true
    else throw new Error(`Unknown argument: ${argument}`)
  }
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
  )
  const evidence = verifyPublicExamples({
    repositoryRoot,
    mode,
    prebuilt
  })
  process.stdout.write(
    `${evidence.status}: ${evidence.examples.length} examples, ${evidence.packages.length} packages\n`
  )
}
