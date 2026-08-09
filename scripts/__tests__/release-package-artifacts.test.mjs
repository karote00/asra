import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  createReleasePackageArtifactPlan,
  packFrameworkReleasePackages,
  resolveReleaseArtifactDirectory,
  validateFrameworkReleasePackageArtifacts
} from '../release-package-artifacts.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const temporaryParent = path.join(repositoryRoot, 'tmp')
const tarballPathFor = ({ artifactDirectory, packageName, version }) =>
  path.join(
    artifactDirectory,
    `${packageName.replace(/^@/u, '').replace('/', '-')}-${version}.tgz`
  )

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
  const firstVersion = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, 'packages/ai-agent-runtime/package.json'),
      'utf8'
    )
  ).version
  const lastVersion = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, 'packages/utils/package.json'),
      'utf8'
    )
  ).version
  assert.deepEqual(plan[0], {
    packageName: '@asyra/ai-agent-runtime',
    version: firstVersion,
    workspaceDirectory: 'packages/ai-agent-runtime',
    tarballPath: tarballPathFor({
      artifactDirectory,
      packageName: '@asyra/ai-agent-runtime',
      version: firstVersion
    })
  })
  assert.deepEqual(plan.at(-1), {
    packageName: '@asyra/utils',
    version: lastVersion,
    workspaceDirectory: 'packages/utils',
    tarballPath: tarballPathFor({
      artifactDirectory,
      packageName: '@asyra/utils',
      version: lastVersion
    })
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

test('every release package manifest declares the publishable artifact contract', () => {
  const plan = createReleasePackageArtifactPlan({
    repositoryRoot,
    artifactDirectory: path.join(temporaryParent, 'framework-release-artifacts')
  })

  assert.equal(fs.existsSync(path.join(repositoryRoot, 'LICENSE')), true)

  for (const record of plan) {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(repositoryRoot, record.workspaceDirectory, 'package.json'),
        'utf8'
      )
    )
    const rootExport = manifest.exports?.['.']

    assert.equal(manifest.license, 'MIT', `${record.packageName} license`)
    assert.equal(manifest.type, 'module', `${record.packageName} type`)
    assert.deepEqual(manifest.engines, { node: '24.x' })
    assert.deepEqual(manifest.files, [
      'dist',
      '!dist/**/__tests__',
      '!dist/**/*.test.*',
      '!dist/**/*.spec.*',
      '!dist/**/*.stories.*'
    ])
    assert.equal(typeof rootExport, 'object', `${record.packageName} exports`)
    assert.equal(
      rootExport.types,
      manifest.types.startsWith('.') ? manifest.types : `./${manifest.types}`
    )
    assert.equal(
      rootExport.import,
      manifest.main.startsWith('.') ? manifest.main : `./${manifest.main}`
    )
    assert.equal(rootExport.default, rootExport.import)
  }
})

test('real package tarballs contain only declared release files and resolvable entrypoints', () => {
  fs.mkdirSync(temporaryParent, { recursive: true })
  const artifactDirectory = fs.mkdtempSync(
    path.join(temporaryParent, 'framework-release-tarball-test-')
  )

  try {
    const result = packFrameworkReleasePackages({
      repositoryRoot,
      artifactDirectory,
      prebuilt: true,
      runCommand(command, args, options) {
        execFileSync(command, args, {
          cwd: options.cwd,
          stdio: 'ignore'
        })
      }
    })

    for (const record of result.packages) {
      const entries = execFileSync('tar', ['-tzf', record.tarballPath], {
        encoding: 'utf8'
      })
        .trim()
        .split('\n')
      const manifest = JSON.parse(
        execFileSync(
          'tar',
          ['-xOf', record.tarballPath, 'package/package.json'],
          { encoding: 'utf8' }
        )
      )
      const serializedManifest = JSON.stringify(manifest)

      assert.ok(
        entries.includes('package/LICENSE'),
        `${record.packageName} LICENSE`
      )
      assert.equal(
        entries.some((entry) =>
          /(^|\/)(coverage|\.turbo|__tests__|node_modules|test-results|playwright-report)(\/|$)|\.(test|spec|stories)\./.test(
            entry
          )
        ),
        false,
        `${record.packageName} repository-only file`
      )
      assert.doesNotMatch(
        serializedManifest,
        /workspace:|(?:file|link|portal|patch):/,
        `${record.packageName} workspace-only dependency`
      )

      const exportedPaths = Object.values(manifest.exports).flatMap((entry) =>
        typeof entry === 'string'
          ? [entry]
          : Object.values(entry).filter((value) => typeof value === 'string')
      )
      for (const exportedPath of exportedPaths) {
        assert.ok(
          entries.includes(`package/${exportedPath.replace(/^\.\//, '')}`),
          `${record.packageName} missing ${exportedPath}`
        )
      }
    }

    const validated = validateFrameworkReleasePackageArtifacts({
      repositoryRoot,
      artifactDirectory
    })
    assert.equal(validated.packages.length, 19)
    assert.equal(
      validated.packages.every(
        (record) =>
          record.fileCount > 0 &&
          record.publicPaths.length > 0 &&
          fs.existsSync(record.tarballPath)
      ),
      true
    )
  } finally {
    fs.rmSync(artifactDirectory, { recursive: true, force: true })
  }
})
