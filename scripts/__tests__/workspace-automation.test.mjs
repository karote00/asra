import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createWorkspaceDevAllPlan } from '../dev-all-plan.js'
import {
  createWorkspaceVersionPlan,
  resolveWorkspaceDependencyRange
} from '../workspace-versions.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
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
    'APP_URL',
    'COLLABORATION_WS_HOST',
    'COLLABORATION_WS_PORT',
    'VITE_COLLABORATION_WS_URL'
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

test('Asyra Design keeps frontend and collaboration server startup separate', () => {
  const rootManifest = readJSON('package.json')
  const appReadme = readText('apps/asyra-design/README.md')

  assert.equal(
    rootManifest.scripts['dev:all'],
    'yarn gen:turbo:check && node scripts/dev-all.js'
  )
  assert.match(appReadme, /yarn dev:all/)
  assert.match(
    appReadme,
    /`dev:all` builds and starts.*workspace packages.*App\s+dev server only/is
  )
  assert.doesNotMatch(
    appReadme,
    /workspace packages,\s+the memory-only WebSocket reference server,\s+and the App dev server/i
  )
  assert.match(
    appReadme,
    /yarn workspace @asyra\/asyra-design collaboration:server/
  )
  assert.match(
    appReadme,
    /yarn workspace @asyra\/asyra-design collaboration:server:start/
  )
  assert.match(appReadme, /http:\/\/localhost:3000\/\?fileId=/)
  assert.match(appReadme, /required non-empty `fileId`/i)
  assert.match(appReadme, /always starts Collaboration/i)
  assert.match(appReadme, /no client persistence provider/i)
  assert.doesNotMatch(appReadme, /browser-local demo database uses IndexedDB/i)
})

test('CI, E2E, and release validation own their bounded integration gates', () => {
  const collaboration = readJSON('packages/collaboration/package.json')
  const vercel = readJSON('vercel.json')
  const ci = readText('.github/workflows/main.yml')
  const e2e = readText('.github/workflows/e2e.yml')
  const releaseValidation = readText('scripts/release-validate.js')

  assert.equal(collaboration.scripts.clean, 'rm -rf dist')
  assert.equal(vercel.buildCommand, 'turbo run react:build')
  assert.match(ci, /yarn gen:turbo:check/)
  assert.match(ci, /yarn deps:validate/)
  assert.doesNotMatch(ci, /yarn release:app:check/)
  assert.match(e2e, /test:e2e:collaboration/)
  assert.match(releaseValidation, /yarn release:app:check --prod=\$\{appName\}/)
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
  const collaborationBuild = runner.indexOf('build:collaboration-server')
  const collaborationStart = runner.indexOf('collaboration:server:start')
  const collaborationReady = runner.indexOf(
    'npx wait-on "http-get://${ASYRA_E2E_COLLABORATION_HEALTH_URL#http://}"'
  )
  const appStart = runner.indexOf(
    'yarn workspace @asyra/asyra-design react:start'
  )

  assert.match(runner, /yarn react:build/)
  assert.match(runner, /yarn workspace @asyra\/asyra-design react:start/)
  assert.doesNotMatch(runner, /workspace @asyra\/asyra-design preview/)
  assert.ok(
    collaborationBuild >= 0,
    'ordinary E2E must build its collaboration server'
  )
  assert.ok(
    collaborationStart > collaborationBuild,
    'ordinary E2E must start collaboration after its server build'
  )
  assert.ok(
    collaborationReady > collaborationStart,
    'ordinary E2E must wait for collaboration before App startup'
  )
  assert.match(
    runner,
    /npx wait-on "http-get:\/\/\$\{ASYRA_E2E_COLLABORATION_HEALTH_URL#http:\/\/\}"/,
    'Collaboration readiness must use the server GET-only health contract'
  )
  assert.ok(
    appStart > collaborationReady,
    'ordinary E2E must start the App only after collaboration is ready'
  )
  assert.match(runner, /ASYRA_E2E_COLLABORATION_SERVER_PID/)
  assert.match(runner, /kill "\$ASYRA_E2E_COLLABORATION_SERVER_PID"/)
})

test('CI isolates the render performance budget before parallel functional E2E', () => {
  const runner = readText('scripts/run-e2e.sh')

  assert.match(
    runner,
    /playwright test --config playwright\.config\.ts e2e\/render-delta-performance\.spec\.ts --workers=1/
  )
  assert.match(runner, /ASYRA_E2E_SKIP_PERFORMANCE=true yarn test:e2e/)
})

test('CI runs balanced AI correctness only for related changes or explicit dispatch', async () => {
  const { isBalancedAiCorrectnessPath, resolveBalancedAiCorrectnessScope } =
    await import('../balanced-ai-correctness-scope.mjs')
  const e2e = readText('.github/workflows/e2e.yml')

  assert.equal(
    isBalancedAiCorrectnessPath(
      'apps/asyra-design/src/ai/composition-actions.ts'
    ),
    true
  )
  assert.equal(
    isBalancedAiCorrectnessPath('packages/factory/src/data-transact.ts'),
    true
  )
  assert.equal(
    isBalancedAiCorrectnessPath('apps/asyra-design/vtracer-tool-server.mjs'),
    true
  )
  assert.equal(
    isBalancedAiCorrectnessPath('docs/ai/apps/asyra-design/README.md'),
    false
  )
  assert.equal(
    isBalancedAiCorrectnessPath('apps/asyra-design/e2e/oval.spec.ts'),
    false
  )
  assert.equal(
    resolveBalancedAiCorrectnessScope({
      changedPaths: ['packages/render/src/render.ts'],
      eventName: 'pull_request',
      manualRequested: false
    }),
    true
  )
  assert.equal(
    resolveBalancedAiCorrectnessScope({
      changedPaths: ['docs/ai/apps/asyra-design/README.md'],
      eventName: 'pull_request',
      manualRequested: false
    }),
    false
  )
  assert.equal(
    resolveBalancedAiCorrectnessScope({
      changedPaths: [],
      eventName: 'workflow_dispatch',
      manualRequested: true
    }),
    true
  )
  assert.equal(
    resolveBalancedAiCorrectnessScope({
      changedPaths: [],
      eventName: 'schedule',
      manualRequested: false
    }),
    false
  )
  assert.match(e2e, /fetch-depth: 0/)
  assert.match(e2e, /node scripts\/balanced-ai-correctness-scope\.mjs/)
  assert.match(e2e, /run_balanced_ai_correctness/)
  assert.match(e2e, /RUN_BALANCED_AI_CORRECTNESS/)
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

test('AI agent runtime is an optional zero-runtime-dependency workspace package', () => {
  const manifestPath = path.join(
    repositoryRoot,
    'packages/ai-agent-runtime/package.json'
  )

  assert.ok(
    fs.existsSync(manifestPath),
    '@asyra/ai-agent-runtime must have a workspace manifest'
  )

  const runtime = readJSON('packages/ai-agent-runtime/package.json')
  const runtimeTypeScript = readJSON('packages/ai-agent-runtime/tsconfig.json')
  const app = readJSON('apps/asyra-design/package.json')
  const factory = readJSON('packages/factory/package.json')
  const factoryTypeScript = readJSON('packages/factory/tsconfig.json')
  const turbo = readJSON('turbo.json')

  assert.equal(runtime.name, '@asyra/ai-agent-runtime')
  assert.equal(runtime.version, '0.2.5')
  assert.equal(runtime.main, 'dist/index.js')
  assert.equal(runtime.types, 'dist/index.d.ts')
  assert.equal(
    runtime.scripts['build:ai-agent-runtime'],
    factory.scripts['build:factory']
  )
  assert.deepEqual(runtime.dependencies ?? {}, {})
  assert.deepEqual(
    runtimeTypeScript.compilerOptions,
    factoryTypeScript.compilerOptions
  )
  assert.deepEqual(runtimeTypeScript.include, factoryTypeScript.include)
  assert.deepEqual(runtimeTypeScript.exclude, factoryTypeScript.exclude)
  assert.equal(
    app.dependencies['@asyra/ai-agent-runtime'],
    'workspace:*',
    'Asyra Design must opt into the optional runtime explicitly'
  )
  assert.deepEqual(
    turbo.tasks['@asyra/ai-agent-runtime#build:ai-agent-runtime']?.dependsOn,
    []
  )
  assert.ok(
    turbo.tasks['@asyra/asyra-design#react:build']?.dependsOn.includes(
      '@asyra/ai-agent-runtime#build:ai-agent-runtime'
    )
  )
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
  assert.equal('serviceBuilds' in plan, false)
  assert.equal('services' in plan, false)
  assert.deepEqual(plan.app, {
    dir: 'apps/asyra-design',
    cmd: 'yarn react:start'
  })
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
