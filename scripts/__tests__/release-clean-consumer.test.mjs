import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  createCleanConsumerPackageManifest,
  createRegistryConsumerPackageManifest,
  DEFAULT_CLEAN_CONSUMER_DIRECTORY,
  prepareCleanConsumer,
  resolveCleanConsumerDirectory,
  verifyCleanConsumer,
  verifyRegistryConsumer
} from '../release-readiness.js'
import { readFrameworkReleaseSource } from '../framework-release-packages.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const artifactDirectory = path.join(
  repositoryRoot,
  'tmp',
  'framework-release-artifacts'
)
const source = readFrameworkReleaseSource({ repositoryRoot })
const packageVersions = Object.fromEntries(
  source.packages.map(({ name, version }) => [name, version])
)

test('durable consumer fixture never snapshots Framework release versions', () => {
  const fixtureManifest = JSON.parse(
    fs.readFileSync(
      path.join(
        repositoryRoot,
        'fixtures',
        'framework-release-consumer',
        'package.json'
      ),
      'utf8'
    )
  )
  const packageDependencies = Object.entries(
    fixtureManifest.dependencies ?? {}
  ).filter(([name]) => name.startsWith('@asyra/'))

  assert.equal(packageDependencies.length, 19)
  packageDependencies.forEach(([, specifier]) => {
    assert.equal(specifier, 'workspace:*')
  })
})

test('clean consumer path is constrained to one project tmp child', () => {
  assert.equal(
    resolveCleanConsumerDirectory({ repositoryRoot }),
    path.join(repositoryRoot, DEFAULT_CLEAN_CONSUMER_DIRECTORY)
  )
  assert.throws(
    () =>
      resolveCleanConsumerDirectory({
        repositoryRoot,
        consumerDirectory: 'fixtures/framework-release-consumer'
      }),
    /direct child of project tmp/
  )
})

test('clean consumer replaces every frozen package with one packed artifact', () => {
  const manifest = createCleanConsumerPackageManifest({
    repositoryRoot,
    artifactDirectory
  })
  const packageDependencies = Object.entries(manifest.dependencies).filter(
    ([name]) => name.startsWith('@asyra/')
  )

  assert.equal(packageDependencies.length, 19)
  packageDependencies.forEach(([name, specifier]) => {
    assert.match(specifier, /^file:\.\.\/framework-release-artifacts\//)
    assert.ok(specifier.endsWith(`-${packageVersions[name]}.tgz`))
    assert.doesNotMatch(specifier, /packages\/|workspace:|node_modules/)
    assert.ok(name.startsWith('@asyra/'))
    assert.equal(manifest.resolutions[name], specifier)
  })
  assert.equal(manifest.resolutions.vite, '6.4.3')
})

test('registry consumer derives exact public versions from package manifests', () => {
  const manifest = createRegistryConsumerPackageManifest({ repositoryRoot })
  const packageDependencies = Object.entries(manifest.dependencies).filter(
    ([name]) => name.startsWith('@asyra/')
  )

  assert.equal(packageDependencies.length, 19)
  packageDependencies.forEach(([name, specifier]) => {
    assert.equal(specifier, packageVersions[name])
    assert.doesNotMatch(specifier, /workspace:|(?:file|link|portal|patch):/)
  })
  assert.equal(manifest.resolutions.vite, '6.4.3')
})

test('clean consumer runner owns install, compile, build, test, and cleanup', () => {
  const consumerDirectory = path.join(
    repositoryRoot,
    'tmp',
    'framework-release-consumer-test'
  )
  const evidenceDirectory = path.join(
    repositoryRoot,
    'tmp',
    'framework-release-evidence-test'
  )
  const commands = []
  const installedPackageDirectories = []

  try {
    const evidence = verifyCleanConsumer({
      repositoryRoot,
      artifactDirectory,
      consumerDirectory,
      evidenceDirectory,
      allowUnsupportedNode: true,
      runCommand: (command, args, options) => {
        commands.push({ command, args, cwd: options.cwd })
        if (args[0] !== 'install') return
        const manifest = JSON.parse(
          fs.readFileSync(path.join(options.cwd, 'package.json'), 'utf8')
        )
        Object.keys(manifest.dependencies)
          .filter((name) => name.startsWith('@asyra/'))
          .forEach((name) => {
            const packageDirectory = path.join(
              options.cwd,
              'node_modules',
              ...name.split('/')
            )
            fs.mkdirSync(packageDirectory, { recursive: true })
            fs.writeFileSync(
              path.join(packageDirectory, 'package.json'),
              `${JSON.stringify({ name, version: packageVersions[name] })}\n`
            )
            installedPackageDirectories.push(packageDirectory)
          })
      }
    })

    assert.deepEqual(
      commands.map(({ command, args }) => [command, ...args]),
      [
        ['yarn', 'install', '--no-immutable'],
        ['yarn', 'typecheck'],
        ['yarn', 'build'],
        ['yarn', 'test']
      ]
    )
    assert.equal(
      commands.every(({ cwd }) => cwd === consumerDirectory),
      true
    )
    assert.equal(installedPackageDirectories.length, 19)
    assert.equal(fs.existsSync(consumerDirectory), false)
    assert.equal(evidence.status, 'DIAGNOSTIC')
    assert.deepEqual(evidence.phases, ['install', 'typecheck', 'build', 'test'])
    assert.equal(evidence.packages.length, 19)
  } finally {
    fs.rmSync(consumerDirectory, { recursive: true, force: true })
    fs.rmSync(evidenceDirectory, { recursive: true, force: true })
  }
})

test('registry consumer proves npm resolution before running public gates', () => {
  const consumerDirectory = path.join(
    repositoryRoot,
    'tmp',
    'framework-registry-consumer-test'
  )
  const evidenceDirectory = path.join(
    repositoryRoot,
    'tmp',
    'framework-registry-evidence-test'
  )
  const commands = []

  try {
    const evidence = verifyRegistryConsumer({
      repositoryRoot,
      consumerDirectory,
      evidenceDirectory,
      allowUnsupportedNode: true,
      runCommand: (command, args, options) => {
        commands.push([command, ...args])
        if (args[0] !== 'install') return
        const lockfileBlocks = []
        for (const [name, version] of Object.entries(packageVersions)) {
          const packageDirectory = path.join(
            options.cwd,
            'node_modules',
            ...name.split('/')
          )
          fs.mkdirSync(packageDirectory, { recursive: true })
          fs.writeFileSync(
            path.join(packageDirectory, 'package.json'),
            `${JSON.stringify({ name, version })}\n`
          )
          lockfileBlocks.push(
            `"${name}@npm:${version}":\n  resolution: "${name}@npm:${version}"\n  checksum: test/${name}\n`
          )
        }
        fs.writeFileSync(
          path.join(options.cwd, 'yarn.lock'),
          lockfileBlocks.join('\n')
        )
      }
    })

    assert.deepEqual(commands, [
      ['yarn', 'install', '--no-immutable'],
      ['yarn', 'typecheck'],
      ['yarn', 'build'],
      ['yarn', 'test']
    ])
    assert.equal(evidence.status, 'DIAGNOSTIC')
    assert.deepEqual(evidence.phases, ['install', 'typecheck', 'build', 'test'])
    assert.equal(evidence.packages.length, 19)
    evidence.packages.forEach(({ name, version, resolution, checksum }) => {
      assert.equal(version, packageVersions[name])
      assert.equal(resolution, 'npm')
      assert.equal(checksum, `test/${name}`)
    })
  } finally {
    fs.rmSync(consumerDirectory, { recursive: true, force: true })
    fs.rmSync(evidenceDirectory, { recursive: true, force: true })
  }
})

test('clean consumer preparation never changes the durable fixture', () => {
  const consumerDirectory = path.join(
    repositoryRoot,
    'tmp',
    'framework-release-consumer-preparation-test'
  )
  const fixtureManifestPath = path.join(
    repositoryRoot,
    'fixtures',
    'framework-release-consumer',
    'package.json'
  )
  const fixtureBefore = fs.readFileSync(fixtureManifestPath, 'utf8')

  try {
    const prepared = prepareCleanConsumer({
      repositoryRoot,
      artifactDirectory,
      consumerDirectory
    })
    assert.equal(prepared.consumerDirectory, consumerDirectory)
    assert.equal(fs.existsSync(path.join(consumerDirectory, 'yarn.lock')), true)
    assert.equal(fs.readFileSync(fixtureManifestPath, 'utf8'), fixtureBefore)
  } finally {
    fs.rmSync(consumerDirectory, { recursive: true, force: true })
  }
})
