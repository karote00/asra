import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createWorkspaceDevAllPlan } from './dev-all-plan.js'
import {
  createWorkspaceVersionPlan,
  resolveWorkspaceDependencyRange
} from './workspace-versions.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

const readJSON = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'))

const readText = (relativePath) =>
  fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')

const getBuildTask = (manifest) => {
  const task =
    manifest.name === '@asyra/asyra-design'
      ? 'react:build'
      : `build:${manifest.name.split('/').pop()}`
  assert.ok(
    manifest.scripts?.[task],
    `${manifest.name} must declare its canonical ${task} task`
  )
  return task
}

const getWorkspaceManifests = () => {
  const rootManifest = readJSON('package.json')
  const manifests = new Map()

  for (const pattern of rootManifest.workspaces) {
    if (pattern === 'create-app/*') continue
    const baseDirectory = path.join(repositoryRoot, pattern.replace('/*', ''))
    for (const entry of fs.readdirSync(baseDirectory, {
      withFileTypes: true
    })) {
      if (!entry.isDirectory()) continue
      const manifestPath = path.join(baseDirectory, entry.name, 'package.json')
      if (!fs.existsSync(manifestPath)) continue
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      manifests.set(manifest.name, manifest)
    }
  }

  return manifests
}

test('Turbo uses exact workspace task relationships generated from manifests', () => {
  const manifests = getWorkspaceManifests()
  const turbo = readJSON('turbo.json')

  assert.deepEqual(turbo.globalEnv, [
    'ASYRA_DESIGN_APP_URL',
    'ASYRA_DESIGN_COLLABORATION_WS_HOST',
    'ASYRA_DESIGN_COLLABORATION_WS_PORT',
    'VITE_ASYRA_DESIGN_COLLABORATION_WS_URL'
  ])

  for (const [packageName, manifest] of manifests) {
    const buildTask = getBuildTask(manifest)
    const taskName = `${packageName}#${buildTask}`
    const internalDependencies = Object.keys({
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {})
    }).filter((dependency) => manifests.has(dependency))
    const expectedDependencies = internalDependencies.map((dependency) => {
      const dependencyManifest = manifests.get(dependency)
      return `${dependency}#${getBuildTask(dependencyManifest)}`
    })

    assert.deepEqual(
      turbo.tasks[taskName]?.dependsOn ?? [],
      expectedDependencies,
      `${taskName} must depend on the exact build task of each workspace dependency`
    )
  }
})

test('root commands validate the committed Turbo graph without rewriting it', () => {
  const rootManifest = readJSON('package.json')

  assert.equal(rootManifest.scripts.predev, undefined)
  assert.match(rootManifest.scripts['react:build'], /gen:turbo:check/)
  assert.equal(
    rootManifest.scripts['gen:turbo'],
    'node scripts/gen-turbo.js --write'
  )
  assert.equal(
    rootManifest.scripts['gen:turbo:check'],
    'node scripts/gen-turbo.js --check'
  )
  assert.match(rootManifest.scripts['test:local'], /test:scripts/)
  assert.match(rootManifest.scripts['test:ci'], /test:scripts/)
})

test('clean, CI, E2E, and Vercel include the collaboration integration gates', () => {
  const collaboration = readJSON('packages/collaboration/package.json')
  const vercel = readJSON('vercel.json')
  const ci = readText('.github/workflows/main.yml')
  const e2e = readText('.github/workflows/e2e.yml')

  assert.equal(collaboration.scripts.clean, 'rm -rf dist')
  assert.equal(vercel.buildCommand, 'turbo run react:build')
  assert.match(ci, /yarn gen:turbo:check/)
  assert.match(ci, /yarn deps:validate/)
  assert.match(ci, /yarn release:app:check --prod=asyra-design/)
  assert.match(e2e, /test:e2e:collaboration/)
})

test('E2E automation cancels superseded runs and installs only Chromium', () => {
  const e2e = readText('.github/workflows/e2e.yml')
  const chromiumInstallCount = (
    e2e.match(/playwright install --with-deps chromium/g) ?? []
  ).length

  assert.match(e2e, /concurrency:/)
  assert.match(
    e2e,
    /group: e2e-\$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/
  )
  assert.match(e2e, /cancel-in-progress: true/)
  assert.equal(chromiumInstallCount, 2)
  assert.doesNotMatch(e2e, /playwright install --with-deps\s*$/m)
})

test('ordinary E2E uses the diagnostic-enabled app runtime after the workspace build', () => {
  const runner = readText('scripts/run-e2e.sh')

  assert.match(runner, /yarn react:build/)
  assert.match(runner, /yarn workspace @asyra\/asyra-design react:start/)
  assert.doesNotMatch(runner, /workspace @asyra\/asyra-design preview/)
})

test('collaboration follows the shared TypeScript library build convention', () => {
  const collaboration = readJSON('packages/collaboration/package.json')
  const collaborationTypeScript = readJSON(
    'packages/collaboration/tsconfig.json'
  )
  const factory = readJSON('packages/factory/package.json')
  const factoryTypeScript = readJSON('packages/factory/tsconfig.json')

  assert.equal(
    collaboration.scripts['build:collaboration'],
    factory.scripts['build:factory']
  )
  assert.deepEqual(
    collaborationTypeScript.compilerOptions,
    factoryTypeScript.compilerOptions
  )
  assert.deepEqual(collaborationTypeScript.include, factoryTypeScript.include)
  assert.deepEqual(collaborationTypeScript.exclude, factoryTypeScript.exclude)
})

test('dev:all discovers collaboration and orders its Factory dependency first', async () => {
  const plan = await createWorkspaceDevAllPlan(repositoryRoot)
  const initialDirectories = plan.initialBuilds.map(({ dir }) => dir)
  const devDirectories = plan.devProcesses.map(({ dir }) => dir)

  assert.ok(initialDirectories.includes('packages/collaboration'))
  assert.ok(devDirectories.includes('packages/collaboration'))
  assert.ok(
    initialDirectories.indexOf('packages/factory') <
      initialDirectories.indexOf('packages/collaboration')
  )
})

test('workspace version planning includes collaboration without changing files', () => {
  assert.equal(
    resolveWorkspaceDependencyRange({
      environment: 'prod',
      dependencyVersion: '0.2.5'
    }),
    '^0.2.5'
  )
  assert.equal(
    resolveWorkspaceDependencyRange({
      environment: 'dev',
      dependencyVersion: '0.2.5'
    }),
    'workspace:*'
  )

  const plan = createWorkspaceVersionPlan({
    rootDirectory: repositoryRoot,
    environment: 'prod'
  })
  const appUpdate = plan.find(
    ({ packageName }) => packageName === '@asyra/asyra-design'
  )
  const collaborationUpdate = plan.find(
    ({ packageName }) => packageName === '@asyra/collaboration'
  )

  assert.equal(
    appUpdate?.manifest.dependencies['@asyra/collaboration'],
    '^0.2.5'
  )
  assert.equal(
    collaborationUpdate?.manifest.dependencies['@asyra/factory'],
    '^0.2.5'
  )
})
