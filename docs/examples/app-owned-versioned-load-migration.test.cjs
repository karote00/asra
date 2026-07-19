const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const loadExample = () => import('./app-owned-versioned-load-migration.mjs')

const createRegistrar = () => {
  const hooks = []
  return {
    hooks,
    core: {
      registerLoadHook(hook) {
        hooks.push(hook)
      }
    },
    load(document) {
      return hooks.reduce((current, hook) => hook(current), document)
    }
  }
}

test('example accepts the public typed Core load-hook surface', () => {
  const rootNames = [
    path.resolve(__dirname, 'app-owned-versioned-load-migration.mjs'),
    path.resolve(__dirname, 'app-owned-versioned-load-migration.type-test.ts')
  ]
  const program = ts.createProgram(rootNames, {
    allowJs: true,
    checkJs: true,
    esModuleInterop: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2020
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n'
  })

  assert.equal(formatted, '')
})

test('example migrates v1 -> v2 -> v3 in declared order', async () => {
  const { installExampleAppMigrations } = await loadExample()
  const registrar = createRegistrar()
  installExampleAppMigrations(registrar.core)

  const migrated = registrar.load({ version: 'v1', legacyTitle: 'Document' })

  assert.deepEqual(migrated, {
    version: 'v3',
    title: 'Document',
    metadata: { schema: 'v3' }
  })
})

test('already-current documents bypass every semantic transform', async () => {
  const { installExampleAppMigrations } = await loadExample()
  const registrar = createRegistrar()
  installExampleAppMigrations(registrar.core)
  const current = { version: 'v3', title: 'Current' }

  assert.equal(registrar.load(current), current)
})

test('a document at v2 runs only the v2 -> v3 step', async () => {
  const { registerAppVersionMigrations } = await loadExample()
  const registrar = createRegistrar()
  const calls = []
  registerAppVersionMigrations(registrar.core, {
    versions: ['v1', 'v2', 'v3'],
    migrations: [
      {
        from: 'v1',
        to: 'v2',
        migrate: (document) => {
          calls.push('v1-to-v2')
          return { ...document, version: 'v2' }
        }
      },
      {
        from: 'v2',
        to: 'v3',
        migrate: (document) => {
          calls.push('v2-to-v3')
          return { ...document, version: 'v3' }
        }
      }
    ]
  })

  assert.equal(registrar.load({ version: 'v2' }).version, 'v3')
  assert.deepEqual(calls, ['v2-to-v3'])
})

test('missing and unsupported versions fail through app-owned errors', async () => {
  const {
    APP_MIGRATION_ERROR_CODES,
    AppMigrationError,
    installExampleAppMigrations
  } = await loadExample()
  const registrar = createRegistrar()
  installExampleAppMigrations(registrar.core)

  assert.throws(
    () => registrar.load({ title: 'Missing' }),
    (error) =>
      error instanceof AppMigrationError &&
      error.code === APP_MIGRATION_ERROR_CODES.MISSING_VERSION
  )
  assert.throws(
    () => registrar.load({ version: 'v0' }),
    (error) =>
      error instanceof AppMigrationError &&
      error.code === APP_MIGRATION_ERROR_CODES.UNSUPPORTED_VERSION
  )
})

test('each step must produce exactly its declared next version', async () => {
  const {
    APP_MIGRATION_ERROR_CODES,
    AppMigrationError,
    registerAppVersionMigrations
  } = await loadExample()
  const registrar = createRegistrar()
  registerAppVersionMigrations(registrar.core, {
    versions: ['v1', 'v2'],
    migrations: [
      {
        from: 'v1',
        to: 'v2',
        migrate: (document) => ({ ...document, version: 'v3' })
      }
    ]
  })

  assert.throws(
    () => registrar.load({ version: 'v1' }),
    (error) =>
      error instanceof AppMigrationError &&
      error.code === APP_MIGRATION_ERROR_CODES.INVALID_STEP_RESULT
  )
})
