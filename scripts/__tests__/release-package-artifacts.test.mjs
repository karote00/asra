import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  createReleasePackageArtifactPlan,
  packFrameworkReleasePackages,
  resolveReleaseArtifactDirectory
} from '../release-package-artifacts.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const temporaryParent = path.join(repositoryRoot, 'tmp')

test('release package artifact plan packs every frozen package exactly once', () => {
  const artifactDirectory = path.join(
    temporaryParent,
    'framework-release-artifacts'
  )
  const plan = createReleasePackageArtifactPlan({
    repositoryRoot,
    artifactDirectory
  })

  assert.equal(plan.length, 19)
  assert.equal(new Set(plan.map((record) => record.packageName)).size, 19)
  assert.equal(new Set(plan.map((record) => record.tarballPath)).size, 19)
  assert.deepEqual(plan[0], {
    packageName: '@asyra/ai-agent-runtime',
    version: '0.2.5',
    workspaceDirectory: 'packages/ai-agent-runtime',
    tarballPath: path.join(
      artifactDirectory,
      'asyra-ai-agent-runtime-0.2.5.tgz'
    )
  })
  assert.deepEqual(plan.at(-1), {
    packageName: '@asyra/utils',
    version: '0.2.5',
    workspaceDirectory: 'packages/utils',
    tarballPath: path.join(artifactDirectory, 'asyra-utils-0.2.5.tgz')
  })
})

test('release artifact path is constrained to a direct project tmp child', () => {
  assert.equal(
    resolveReleaseArtifactDirectory({
      repositoryRoot,
      artifactDirectory: 'tmp/framework-release-artifacts'
    }),
    path.join(temporaryParent, 'framework-release-artifacts')
  )

  for (const artifactDirectory of [
    '.',
    'packages',
    'tmp',
    'tmp/nested/framework-release-artifacts',
    path.resolve(repositoryRoot, '..', 'framework-release-artifacts')
  ]) {
    assert.throws(
      () =>
        resolveReleaseArtifactDirectory({
          repositoryRoot,
          artifactDirectory
        }),
      /direct child of project tmp/
    )
  }
})

test('package builder runs the canonical build once and packs each package once', () => {
  fs.mkdirSync(temporaryParent, { recursive: true })
  const artifactDirectory = fs.mkdtempSync(
    path.join(temporaryParent, 'framework-release-builder-test-')
  )
  const commands = []

  try {
    const result = packFrameworkReleasePackages({
      repositoryRoot,
      artifactDirectory,
      runCommand(command, args, options) {
        commands.push({ command, args, cwd: options.cwd })
        if (args.includes('pack')) {
          const outputIndex = args.indexOf('--out')
          fs.writeFileSync(args[outputIndex + 1], 'packed')
        }
      }
    })

    assert.deepEqual(commands[0], {
      command: 'yarn',
      args: ['react:build'],
      cwd: repositoryRoot
    })
    assert.equal(commands.length, 20)
    assert.equal(
      commands.slice(1).every(({ command, args, cwd }, index) => {
        const record = result.packages[index]
        return (
          command === 'yarn' &&
          cwd === repositoryRoot &&
          args[0] === 'workspace' &&
          args[1] === record.packageName &&
          args[2] === 'pack' &&
          args[3] === '--out' &&
          args[4] === record.tarballPath
        )
      }),
      true
    )
    assert.equal(
      result.packages.every(({ tarballPath }) => fs.existsSync(tarballPath)),
      true
    )
  } finally {
    fs.rmSync(artifactDirectory, { recursive: true, force: true })
  }
})

test('prebuilt package builder skips the build command without changing pack ownership', () => {
  fs.mkdirSync(temporaryParent, { recursive: true })
  const artifactDirectory = fs.mkdtempSync(
    path.join(temporaryParent, 'framework-release-prebuilt-test-')
  )
  const commands = []

  try {
    const result = packFrameworkReleasePackages({
      repositoryRoot,
      artifactDirectory,
      prebuilt: true,
      runCommand(command, args, options) {
        commands.push({ command, args, cwd: options.cwd })
        const outputIndex = args.indexOf('--out')
        fs.writeFileSync(args[outputIndex + 1], 'packed')
      }
    })

    assert.equal(commands.length, 19)
    assert.equal(result.packages.length, 19)
    assert.equal(
      commands.every(({ args }) => args.includes('pack')),
      true
    )
  } finally {
    fs.rmSync(artifactDirectory, { recursive: true, force: true })
  }
})
