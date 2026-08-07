import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

const readPlan = (script, args = []) => {
  const result = spawnSync(process.execPath, [script, ...args, '--plan'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return JSON.parse(result.stdout)
}

test('full release validates exact artifacts before publish and always restores workspace ranges', () => {
  const plan = readPlan('scripts/release-full.js', ['--prod=asyra-design'])

  assert.deepEqual(plan, {
    prepare: [
      'yarn changeset version',
      'yarn bump:workspace --env=prod',
      'yarn release:app --prod=asyra-design',
      'yarn release:validate --prod=asyra-design'
    ],
    publish: ['yarn changeset publish'],
    finally: ['yarn bump:workspace --env=dev']
  })
})

test('release validation covers build, tests, dependencies, collaboration, and generated template', () => {
  const plan = readPlan('scripts/release-validate.js', ['--prod=asyra-design'])

  assert.deepEqual(plan, [
    'yarn install --immutable',
    'yarn gen:turbo:check',
    'yarn clean',
    'yarn react:build',
    'yarn lint:ci',
    'yarn test:ci',
    'yarn deps:validate',
    'yarn workspace @asyra/asyra-design test:e2e:collaboration',
    'yarn release:app:check --prod=asyra-design',
    'yarn release:app:build --prod=asyra-design --prebuilt'
  ])
})

test('release template exposes a non-mutating synchronization check', () => {
  const manifest = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
  )
  const releaseTemplate = readFileSync(
    path.join(repositoryRoot, 'scripts/release-template.js'),
    'utf8'
  )

  assert.equal(
    manifest.scripts['release:app:check'],
    'node scripts/release-template.js --check'
  )
  assert.match(
    releaseTemplate,
    /const DEST_DIR = CHECK \? CHECK_DIRECTORY : CONFIGURED_DEST_DIR/
  )
  assert.match(
    releaseTemplate,
    /if \(CHECK\) \{\s+process\.on\('exit', \(\) => \{\s+fse\.removeSync\(CHECK_DIRECTORY\)/
  )
})

test('release template excludes local runtime data directories', () => {
  const config = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'release-configs/asyra-design.json'),
      'utf8'
    )
  )

  assert.ok(
    config.cleanFiles.includes('.*-data'),
    'local runtime data directories must never enter the generated template'
  )

  const releaseTemplate = readFileSync(
    path.join(repositoryRoot, 'scripts/release-template.js'),
    'utf8'
  )
  assert.match(releaseTemplate, /\{\s+nodir: true,\s+dot: true\s+\}/)
  assert.match(releaseTemplate, /\{\s+onlyDirectories: true,\s+dot: true\s+\}/)
  assert.match(
    releaseTemplate,
    /const isIgnoredComparisonDirectory = \(name\) =>/
  )
  assert.match(releaseTemplate, /\/\^\\\..\+-data\$\/u\.test\(name\)/)
})

test('generated template manifest is standalone on the supported release runtime', () => {
  const manifest = JSON.parse(
    readFileSync(
      path.join(
        repositoryRoot,
        'create-app/asyra-design/template/package.json'
      ),
      'utf8'
    )
  )
  const serializedScripts = JSON.stringify(manifest.scripts ?? {})

  assert.deepEqual(manifest.engines, { node: '24.x' })
  assert.equal(manifest.packageManager, 'yarn@4.3.1')
  assert.doesNotMatch(serializedScripts, /(?:\.\.\/){2}|--cwd\s+\.\.\/\.\./)
  assert.doesNotMatch(JSON.stringify(manifest), /workspace:|(?:link|portal):/)
  for (const [packageName, version] of Object.entries(
    manifest.dependencies ?? {}
  )) {
    if (!packageName.startsWith('@asyra/')) continue
    const sourceManifest = JSON.parse(
      readFileSync(
        path.join(
          repositoryRoot,
          'packages',
          packageName.slice('@asyra/'.length),
          'package.json'
        ),
        'utf8'
      )
    )
    assert.equal(version, sourceManifest.version)
  }

  const environment = readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/template/.env'),
    'utf8'
  )
  assert.match(environment, /^APP_URL=http:\/\/localhost:3000$/m)
  assert.match(environment, /^VITE_COLLABORATION_WS_URL=$/m)
  assert.doesNotMatch(environment, /(?:SECRET|TOKEN|PASSWORD|API_KEY)=/i)
})

test('generated template documents its verified standalone commands and opt-ins', () => {
  const source = readFileSync(
    path.join(repositoryRoot, 'apps/asyra-design/TEMPLATE.md'),
    'utf8'
  )
  const generated = readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/template/README.md'),
    'utf8'
  )

  assert.equal(generated, source)
  assert.match(generated, /Node\.js 24\.x/)
  for (const command of [
    'yarn install',
    'yarn react:build',
    'yarn test',
    'yarn react:start'
  ]) {
    assert.match(generated, new RegExp(command.replace(' ', String.raw`\s+`)))
  }
  assert.match(generated, /Preset/)
  assert.match(generated, /migration/i)
  assert.match(generated, /Group/)
  assert.match(generated, /same-origin\s+`\/collaboration`/)
  assert.match(generated, /local editing remains available/i)
  assert.doesNotMatch(generated, /Collaboration is disabled/i)
  assert.match(generated, /opt in to AI/i)
})

test('create-app hands the selected package manager a runnable standalone start command', () => {
  const cli = readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/bin/index.js'),
    'utf8'
  )

  assert.doesNotMatch(cli, /console\.log\('\x20{2}yarn dev'\)/)
  assert.match(cli, /yarn:\s*'yarn react:start'/)
  assert.match(cli, /npm:\s*'npm run react:start'/)
  assert.match(cli, /pnpm:\s*'pnpm react:start'/)
  assert.match(cli, /http:\/\/localhost:3000\/\?fileId=my-design/)

  const readme = readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/README.md'),
    'utf8'
  )
  assert.match(readme, /Node\.js 24\.x/)
  assert.match(readme, /yarn react:start/)
  assert.match(readme, /http:\/\/localhost:3000\/\?fileId=my-design/)
  assert.doesNotMatch(readme, /yarn start/)
})

test('release validation copies only repository source into an isolated workspace', async () => {
  const { createReleaseValidationWorkspace, removeReleaseValidationWorkspace } =
    await import('../release-validation-workspace.js')
  mkdirSync(path.join(repositoryRoot, 'tmp'), { recursive: true })
  const testRoot = mkdtempSync(
    path.join(repositoryRoot, 'tmp', 'release-validation-test-')
  )
  const sourceRoot = path.join(testRoot, 'source')
  const validationParent = path.join(testRoot, 'validation')

  mkdirSync(path.join(sourceRoot, 'src'), { recursive: true })
  mkdirSync(path.join(sourceRoot, 'dist'), { recursive: true })
  mkdirSync(path.join(sourceRoot, 'node_modules'), { recursive: true })
  mkdirSync(path.join(sourceRoot, '.git'), { recursive: true })
  mkdirSync(path.join(sourceRoot, 'tmp'), { recursive: true })
  writeFileSync(path.join(sourceRoot, 'package.json'), '{}')
  writeFileSync(path.join(sourceRoot, 'src', 'index.js'), 'export {}')
  writeFileSync(path.join(sourceRoot, 'dist', 'index.js'), 'export {}')
  writeFileSync(path.join(sourceRoot, 'node_modules', 'package.json'), '{}')
  writeFileSync(path.join(sourceRoot, '.git', 'HEAD'), 'ref: main')
  writeFileSync(path.join(sourceRoot, 'tmp', 'artifact'), 'temporary')
  writeFileSync(path.join(sourceRoot, '.env'), 'SECRET=local')
  writeFileSync(path.join(sourceRoot, '.env.local'), 'SECRET=local')
  writeFileSync(path.join(sourceRoot, '.env.example'), 'PUBLIC=example')

  let validationRoot
  try {
    validationRoot = createReleaseValidationWorkspace({
      sourceRoot,
      validationParent
    })

    assert.notEqual(validationRoot, sourceRoot)
    assert.equal(existsSync(path.join(validationRoot, 'package.json')), true)
    assert.equal(existsSync(path.join(validationRoot, 'src', 'index.js')), true)
    assert.equal(existsSync(path.join(validationRoot, '.env')), true)
    assert.equal(existsSync(path.join(validationRoot, '.env.example')), true)
    for (const excludedPath of [
      '.git',
      'dist',
      'node_modules',
      'tmp',
      '.env.local'
    ]) {
      assert.equal(existsSync(path.join(validationRoot, excludedPath)), false)
    }

    removeReleaseValidationWorkspace(validationRoot, validationParent)
    assert.equal(existsSync(validationRoot), false)
    validationRoot = undefined
  } finally {
    if (validationRoot) {
      removeReleaseValidationWorkspace(validationRoot, validationParent)
    }
    rmSync(testRoot, { recursive: true, force: true })
  }
})

test('release validation supplies matching app and collaboration endpoints', async () => {
  const { createReleaseValidationEnvironment } = await import(
    '../release-validation-environment.js'
  )

  assert.deepEqual(
    createReleaseValidationEnvironment({
      appPort: 4317,
      collaborationPort: 5109,
      environment: { RELEASE_TOKEN: 'preserved' }
    }),
    {
      RELEASE_TOKEN: 'preserved',
      APP_URL: 'http://127.0.0.1:4317',
      COLLABORATION_WS_PORT: '5109',
      VITE_COLLABORATION_WS_URL: 'ws://127.0.0.1:5109/collaboration'
    }
  )
})
