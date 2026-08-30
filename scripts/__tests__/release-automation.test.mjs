import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
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
      'yarn release:app --prod=asyra-design',
      'yarn release:validate --prod=asyra-design',
      'yarn bump:workspace --env=release',
      'yarn release:ranges:check'
    ],
    publish: ['yarn changeset publish'],
    finally: ['yarn bump:workspace --env=dev']
  })
})

test('release validation covers build, tests, dependencies, collaboration, and generated template', () => {
  const plan = readPlan('scripts/release-validate.js', ['--prod=asyra-design'])

  assert.deepEqual(plan, [
    'yarn install --immutable',
    'yarn security:audit',
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

test('public release gates high-severity dependency advisories', () => {
  const manifest = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
  )
  const workflow = readFileSync(
    path.join(repositoryRoot, '.github/workflows/main.yml'),
    'utf8'
  )

  assert.equal(
    manifest.scripts['security:audit'],
    'yarn npm audit --all --recursive --severity high'
  )
  assert.match(
    workflow,
    /- name: Audit high-severity dependencies\s+run: yarn security:audit/u
  )
})

test('generated template smoke build resolves tooling through its synchronized canonical app', () => {
  const buildReleaseTemplate = readFileSync(
    path.join(repositoryRoot, 'scripts/build-release-template.js'),
    'utf8'
  )

  assert.match(
    buildReleaseTemplate,
    /const sourceRoot = path\.resolve\(repositoryRoot, releaseConfig\.src\)/
  )
  assert.match(
    buildReleaseTemplate,
    /const sourceConfigPath = path\.join\(sourceRoot, 'vite\.config\.ts'\)/
  )
  assert.match(
    buildReleaseTemplate,
    /'build',\s+templateRoot,\s+'--config',\s+sourceConfigPath/
  )
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

  assert.deepEqual(config.cleanFiles, [
    'node_modules',
    'yarn.lock',
    'package-lock.json',
    'pnpm-lock.yaml',
    '.pnp.cjs',
    '.pnp.loader.mjs',
    '.DS_Store',
    '.env*',
    '.*-data',
    '.turbo',
    'coverage',
    'dist',
    'playwright-report',
    'test-results',
    'visual-review-records',
    'samples/crdt-7076',
    'test-data/ai-drawing/maximum-tabby-polygon.svg',
    'e2e/crdt-7076-render.spec.ts',
    'scripts/generate-crdt-7076-document.ts'
  ])

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

test('Asyra Design release template retains only active drawing fixtures', () => {
  const config = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'release-configs/asyra-design.json'),
      'utf8'
    )
  )
  const retiredPaths = [
    'visual-review-records',
    'test-data/ai-drawing/detailed-tabby-cat-only-white-background.png',
    'test-data/ai-drawing/detailed-tabby-polygon.svg'
  ]

  assert.equal(config.cleanFiles.includes('visual-review-records'), true)
  for (const retiredPath of retiredPaths) {
    assert.equal(
      existsSync(
        path.join(
          repositoryRoot,
          'create-app/asyra-design/template',
          retiredPath
        )
      ),
      false,
      `generated ${retiredPath}`
    )
  }

  for (const requiredPath of [
    'test-data/ai-drawing/__tests__/action-batch-interceptor.test.ts',
    'test-data/ai-drawing/detailed-tabby.ts',
    'test-data/ai-drawing/maximum-tabby-polygon.svg'
  ]) {
    assert.equal(
      existsSync(path.join(repositoryRoot, 'apps/asyra-design', requiredPath)),
      true,
      requiredPath
    )
  }
})

test('Asyra Design keeps the large CRDT fixture out of the generated template', () => {
  const config = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'release-configs/asyra-design.json'),
      'utf8'
    )
  )
  const canonicalFixture = path.join(
    repositoryRoot,
    'apps/asyra-design/samples/crdt-7076/action-batch.json'
  )
  const generatedFixtureRoot = path.join(
    repositoryRoot,
    'create-app/asyra-design/template/samples/crdt-7076'
  )

  assert.equal(existsSync(canonicalFixture), true)
  assert.equal(existsSync(generatedFixtureRoot), false)
  assert.deepEqual(config.removeScripts, [
    'generate:crdt-7076-document',
    'test:e2e:crdt-7076'
  ])
  assert.equal(
    existsSync(
      path.join(
        repositoryRoot,
        'apps/asyra-design/test-data/ai-drawing/maximum-tabby-polygon.svg'
      )
    ),
    true
  )
  assert.equal(
    existsSync(
      path.join(
        repositoryRoot,
        'create-app/asyra-design/template/test-data/ai-drawing/maximum-tabby-polygon.svg'
      )
    ),
    false
  )
  for (const generatedOnlyTestPath of [
    'e2e/crdt-7076-render.spec.ts',
    'scripts/generate-crdt-7076-document.ts'
  ]) {
    assert.equal(
      existsSync(
        path.join(
          repositoryRoot,
          'create-app/asyra-design/template',
          generatedOnlyTestPath
        )
      ),
      false,
      generatedOnlyTestPath
    )
  }
})

test('Asyra Design canonical source excludes retired CRA and duplicate template artifacts', () => {
  const manifest = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'apps/asyra-design/package.json'),
      'utf8'
    )
  )
  const config = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'release-configs/asyra-design.json'),
      'utf8'
    )
  )

  assert.equal(manifest.dependencies?.['web-vitals'], undefined)
  assert.equal(manifest.dependencies?.['react-scripts'], undefined)
  assert.equal(config.readme, undefined)
  assert.equal(config.exampleEnvironment, undefined)

  for (const retiredPath of [
    'TEMPLATE.md',
    'e2e/.gitkeep',
    'public/logo512.png',
    'public/manifest.json',
    'src/logo.svg',
    'src/react-app-env.d.ts',
    'src/reportWebVitals.ts'
  ]) {
    assert.equal(
      existsSync(path.join(repositoryRoot, 'apps/asyra-design', retiredPath)),
      false,
      retiredPath
    )
    assert.equal(
      existsSync(
        path.join(
          repositoryRoot,
          'create-app/asyra-design/template',
          retiredPath
        )
      ),
      false,
      `generated ${retiredPath}`
    )
  }

  assert.equal(
    existsSync(
      path.join(repositoryRoot, 'apps/asyra-design/src/animation/index.tsx')
    ),
    true,
    'the reserved animation source must remain available'
  )
})

test('generated template contains required public files and no repository-only state', () => {
  const templateRoot = path.join(
    repositoryRoot,
    'create-app/asyra-design/template'
  )
  const expectedLicense = readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/LICENSE'),
    'utf8'
  )

  assert.equal(
    readFileSync(path.join(templateRoot, 'LICENSE'), 'utf8'),
    expectedLicense
  )
  assert.equal(existsSync(path.join(templateRoot, '.env')), false)
  assert.equal(existsSync(path.join(templateRoot, '.env.example')), true)
  assert.equal(
    existsSync(path.join(repositoryRoot, 'apps/asyra-design', '.env')),
    false
  )
  assert.equal(
    existsSync(path.join(repositoryRoot, 'apps/asyra-design', '.env.example')),
    true
  )
  assert.equal(
    readFileSync(
      path.join(
        repositoryRoot,
        'create-app/asyra-design/template/.env.example'
      ),
      'utf8'
    ),
    readFileSync(
      path.join(repositoryRoot, 'apps/asyra-design/.env.example'),
      'utf8'
    )
  )
  for (const repositoryOnlyPath of [
    '.turbo',
    'coverage',
    'dist',
    'playwright-report',
    'test-results'
  ]) {
    assert.equal(
      existsSync(path.join(templateRoot, repositoryOnlyPath)),
      false,
      repositoryOnlyPath
    )
  }
})

test('repository ignores private environment files without hiding examples', () => {
  for (const privateEnvironmentPath of [
    '.env',
    '.env.local',
    'packages/core/.env',
    'apps/asyra-framework-site/.env.production'
  ]) {
    const result = spawnSync(
      'git',
      ['check-ignore', '--no-index', '--quiet', privateEnvironmentPath],
      {
        cwd: repositoryRoot,
        encoding: 'utf8'
      }
    )

    assert.equal(
      result.status,
      0,
      `${privateEnvironmentPath} must be ignored by the repository root`
    )
  }

  for (const exampleEnvironmentPath of [
    '.env.example',
    'packages/core/.env.example'
  ]) {
    const result = spawnSync(
      'git',
      ['check-ignore', '--no-index', '--quiet', exampleEnvironmentPath],
      {
        cwd: repositoryRoot,
        encoding: 'utf8'
      }
    )

    assert.equal(
      result.status,
      1,
      `${exampleEnvironmentPath} must remain available as documentation`
    )
  }
})

test('packed create-app inventory excludes repository-only generated state', () => {
  const result = spawnSync(
    'npm',
    ['pack', './create-app/asyra-design', '--dry-run', '--json'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8'
    }
  )
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const [pack] = JSON.parse(result.stdout)
  const packedPaths = pack.files.map(({ path: packedPath }) => packedPath)

  assert.ok(packedPaths.includes('README.md'))
  assert.ok(packedPaths.includes('LICENSE'))
  assert.ok(packedPaths.includes('bin/index.js'))
  assert.ok(packedPaths.includes('template/LICENSE'))
  for (const segment of [
    '.turbo/',
    'coverage/',
    'dist/',
    'playwright-report/',
    'test-results/'
  ]) {
    assert.equal(
      packedPaths.some((packedPath) => packedPath.includes(segment)),
      false,
      segment
    )
  }
})

test('each app and its create-app package share one release version', () => {
  const createAppManifest = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'create-app/asyra-design/package.json'),
      'utf8'
    )
  )
  const appManifest = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'apps/asyra-design/package.json'),
      'utf8'
    )
  )

  assert.equal(createAppManifest.version, appManifest.version)
})

test('Framework site and root share one release version', () => {
  const rootManifest = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
  )
  const siteManifest = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'apps/asyra-framework-site/package.json'),
      'utf8'
    )
  )

  assert.equal(siteManifest.version, rootManifest.version)
})

test('create-app package metadata matches the supported public CLI contract', () => {
  const manifest = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'create-app/asyra-design/package.json'),
      'utf8'
    )
  )

  assert.equal(
    manifest.description,
    'Create a ready-to-use Asyra Design canvas and visual editor app'
  )
  assert.equal(manifest.license, 'MIT')
  assert.deepEqual(manifest.engines, { node: '24.x' })
  assert.equal(manifest.packageManager, 'yarn@4.3.1')
  assert.deepEqual(manifest.repository, {
    type: 'git',
    url: 'git+https://github.com/karote00/asyra.git',
    directory: 'create-app/asyra-design'
  })
  assert.equal(manifest.homepage, 'https://asyra-framework.vercel.app')
  assert.ok(manifest.keywords.includes('canvas-editor'))
  assert.ok(manifest.keywords.includes('visual-editor'))
})

test('root and Core metadata identify the searchable product category', () => {
  const rootManifest = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
  )
  const coreManifest = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'packages/core/package.json'),
      'utf8'
    )
  )

  assert.equal(
    rootManifest.description,
    'Composable framework for canvas-based, visual, and domain-driven products.'
  )
  assert.equal(
    coreManifest.description,
    'Public composition core for canvas-based, visual, and domain-driven Asyra products'
  )
  for (const keyword of [
    'canvas-framework',
    'canvas-editor',
    'visual-editor',
    'whiteboard',
    'bim',
    'undo-redo'
  ]) {
    assert.ok(rootManifest.keywords.includes(keyword), keyword)
    assert.ok(coreManifest.keywords.includes(keyword), keyword)
  }
  assert.deepEqual(coreManifest.repository, {
    type: 'git',
    url: 'git+https://github.com/karote00/asyra.git',
    directory: 'packages/core'
  })
  assert.equal(coreManifest.homepage, 'https://asyra-framework.vercel.app')
})

test('every public Framework package identifies its repository location', () => {
  const packagesRoot = path.join(repositoryRoot, 'packages')

  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const manifestPath = path.join(packagesRoot, entry.name, 'package.json')
    if (!existsSync(manifestPath)) continue

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (manifest.private === true) continue

    assert.deepEqual(
      manifest.repository,
      {
        type: 'git',
        url: 'git+https://github.com/karote00/asyra.git',
        directory: `packages/${entry.name}`
      },
      manifest.name
    )
    assert.equal(
      manifest.homepage,
      'https://asyra-framework.vercel.app',
      manifest.name
    )
  }
})

test('Asyra Design keeps build and test tooling out of production dependencies', () => {
  const manifest = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'apps/asyra-design/package.json'),
      'utf8'
    )
  )
  const developmentOnlyPackages = [
    '@testing-library/dom',
    '@testing-library/react',
    '@testing-library/user-event',
    '@types/node',
    'typescript'
  ]

  for (const packageName of developmentOnlyPackages) {
    assert.equal(manifest.dependencies?.[packageName], undefined, packageName)
    assert.equal(
      typeof manifest.devDependencies?.[packageName],
      'string',
      packageName
    )
  }

  for (const retiredPackage of ['@testing-library/jest-dom', '@types/jest']) {
    assert.equal(manifest.dependencies?.[retiredPackage], undefined)
    assert.equal(manifest.devDependencies?.[retiredPackage], undefined)
  }
  const retiredSetupPath = path.join(
    repositoryRoot,
    'apps/asyra-design/src/setupTests.ts'
  )
  assert.equal(existsSync(retiredSetupPath), false)
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
  assert.equal(manifest.scripts?.start, 'vite dev')
  assert.equal(manifest.scripts?.['react:start'], undefined)
  assert.equal(manifest.devDependencies?.prettier, '^3.4.2')
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

  const exampleEnvironment = readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/template/.env.example'),
    'utf8'
  )
  assert.match(exampleEnvironment, /^APP_URL=http:\/\/localhost:3000$/m)
  assert.match(exampleEnvironment, /^COLLABORATION_WS_HOST=127\.0\.0\.1$/m)
  assert.match(exampleEnvironment, /^COLLABORATION_WS_PORT=4101$/m)
  assert.match(
    exampleEnvironment,
    /^VITE_COLLABORATION_WS_URL=ws:\/\/127\.0\.0\.1:4101\/collaboration$/m
  )
  assert.doesNotMatch(exampleEnvironment, /(?:SECRET|TOKEN|PASSWORD|API_KEY)=/i)
})

test('canonical Asyra Design source uses workspace Framework dependencies during development', () => {
  const manifest = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'apps/asyra-design/package.json'),
      'utf8'
    )
  )
  const frameworkDependencies = Object.entries(
    manifest.dependencies ?? {}
  ).filter(([packageName]) => packageName.startsWith('@asyra/'))

  assert.ok(frameworkDependencies.length > 0)
  for (const [packageName, version] of frameworkDependencies) {
    assert.equal(version, 'workspace:*', packageName)
  }
  assert.equal(manifest.scripts?.typecheck, 'tsc -p tsconfig.typecheck.json')

  const typecheckConfig = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'apps/asyra-design/tsconfig.typecheck.json'),
      'utf8'
    )
  )
  assert.equal(typecheckConfig.extends, './tsconfig.json')
  assert.ok(typecheckConfig.exclude.includes('src/**/__tests__/**'))
  assert.ok(typecheckConfig.exclude.includes('src/**/*.test.*'))
})

test('generated template documents its verified standalone commands and opt-ins', () => {
  const source = readFileSync(
    path.join(repositoryRoot, 'apps/asyra-design/README.md'),
    'utf8'
  )
  const generated = readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/template/README.md'),
    'utf8'
  )

  assert.equal(generated, source.replaceAll('../../LICENSE', 'LICENSE'))
  assert.match(generated, /Node\.js 24\.x/)
  for (const command of [
    'yarn install',
    'yarn react:build',
    'yarn test',
    'yarn start'
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

test('create-app installs once and hands the selected package manager a runnable start command', () => {
  const cli = readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/bin/index.js'),
    'utf8'
  )

  assert.doesNotMatch(cli, /console\.log\('\x20{2}yarn dev'\)/)
  assert.match(cli, /yarn:\s*'yarn start'/)
  assert.match(cli, /npm:\s*'npm run start'/)
  assert.match(cli, /pnpm:\s*'pnpm start'/)
  assert.match(cli, /yarn:\s*'yarn install'/)
  assert.match(cli, /npm:\s*'npm install'/)
  assert.match(cli, /pnpm:\s*'pnpm install'/)
  assert.match(
    cli,
    /packageManager === 'yarn'[\s\S]*\.yarnrc\.yml[\s\S]*nodeLinker: node-modules/
  )
  assert.match(cli, /http:\/\/localhost:3000\/\?fileId=my-design/)

  const readme = readFileSync(
    path.join(repositoryRoot, 'create-app/asyra-design/README.md'),
    'utf8'
  )
  assert.match(readme, /Node\.js 24\.x/)
  assert.doesNotMatch(readme, /yarn install/)
  assert.doesNotMatch(readme, /npm install/)
  assert.doesNotMatch(readme, /pnpm install/)
  assert.match(readme, /yarn start/)
  assert.match(readme, /npm run start/)
  assert.match(readme, /pnpm start/)
  assert.match(readme, /http:\/\/localhost:3000\/\?fileId=my-design/)
  assert.doesNotMatch(readme, /react:start/)
})

test('create-app supports deterministic package-manager selection and rejects unsafe targets', () => {
  const cliPath = path.join(
    repositoryRoot,
    'create-app/asyra-design/bin/index.js'
  )
  const cli = readFileSync(cliPath, 'utf8')

  assert.match(cli, /--package-manager/)
  assert.match(cli, /yarn.*npm.*pnpm/s)
  assert.match(cli, /yarn:\s*\['install', '--no-immutable'\]/)
  assert.match(cli, /pnpm:\s*\['install', '--no-frozen-lockfile'\]/)

  mkdirSync(path.join(repositoryRoot, 'tmp'), { recursive: true })
  const testRoot = mkdtempSync(
    path.join(repositoryRoot, 'tmp', 'create-app-target-test-')
  )
  const invocationRoot = path.join(testRoot, 'invocation')
  mkdirSync(invocationRoot)

  try {
    const createPrefixedTarget = spawnSync(
      process.execPath,
      [cliPath, 'create-valid-app', '--package-manager=unsupported'],
      {
        cwd: invocationRoot,
        encoding: 'utf8'
      }
    )

    assert.notEqual(createPrefixedTarget.status, 0)
    assert.match(
      `${createPrefixedTarget.stderr}${createPrefixedTarget.stdout}`,
      /unsupported package manager/i,
      'a legitimate create-* project name must remain the target argument'
    )

    const result = spawnSync(
      process.execPath,
      [cliPath, '../escaped', '--package-manager=yarn'],
      {
        cwd: invocationRoot,
        encoding: 'utf8'
      }
    )

    assert.notEqual(result.status, 0)
    assert.match(`${result.stderr}${result.stdout}`, /project name.*directory/i)
    assert.equal(existsSync(path.join(testRoot, 'escaped')), false)
  } finally {
    rmSync(testRoot, { recursive: true, force: true })
  }
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
    assert.equal(existsSync(path.join(validationRoot, '.git')), true)
    assert.equal(
      spawnSync('git', ['rev-parse', '--show-toplevel'], {
        cwd: validationRoot,
        encoding: 'utf8'
      }).stdout.trim(),
      validationRoot
    )
    assert.equal(
      spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
        cwd: validationRoot,
        encoding: 'utf8'
      }).status,
      0
    )
    assert.equal(
      spawnSync('git', ['status', '--porcelain'], {
        cwd: validationRoot,
        encoding: 'utf8'
      }).stdout,
      ''
    )
    for (const excludedPath of ['dist', 'node_modules', 'tmp', '.env.local']) {
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
  const {
    createReleaseValidationBaseEnvironment,
    createReleaseValidationEnvironment
  } = await import('../release-validation-environment.js')

  const ambientEnvironment = {
    RELEASE_TOKEN: 'preserved',
    APP_URL: 'http://127.0.0.1:9997',
    COLLABORATION_WS_PORT: '9998',
    VITE_COLLABORATION_WS_URL: 'ws://127.0.0.1:9998/collaboration'
  }

  assert.deepEqual(
    createReleaseValidationBaseEnvironment({
      environment: ambientEnvironment
    }),
    { RELEASE_TOKEN: 'preserved' }
  )

  assert.deepEqual(
    createReleaseValidationEnvironment({
      appPort: 4317,
      collaborationPort: 5109,
      environment: ambientEnvironment
    }),
    {
      RELEASE_TOKEN: 'preserved',
      APP_URL: 'http://127.0.0.1:4317',
      COLLABORATION_WS_PORT: '5109',
      VITE_COLLABORATION_WS_URL: 'ws://127.0.0.1:5109/collaboration'
    }
  )
})
