const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const loadExample = () => import('../app-owned-versioned-load-migration.mjs')

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
    path.resolve(__dirname, '../app-owned-versioned-load-migration.mjs'),
    path.resolve(
      __dirname,
      '../app-owned-versioned-load-migration.type-test.ts'
    )
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

test('copyable domain example produces only the terminal schema', async () => {
  const { installExampleAppMigrations } = await loadExample()
  const registrar = createRegistrar()
  installExampleAppMigrations(registrar.core)

  assert.deepEqual(
    registrar.load({ version: 'v1', legacyTitle: 'Document' }),
    {
      version: 'v3',
      title: 'Document',
      metadata: { schema: 'v3' }
    }
  )
})

test('registers one dispatcher and follows a non-contiguous chain by version lookup', async () => {
  const { registerAppVersionMigrations } = await loadExample()
  const registrar = createRegistrar()
  const calls = []
  registerAppVersionMigrations(registrar.core, {
    migrations: [
      {
        from: 'v3',
        to: 'v8',
        migrate: (document) => {
          calls.push('v3-to-v8')
          return { ...document, version: 'v8', migratedToV8: true }
        }
      },
      {
        from: 'v1',
        to: 'v3',
        migrate: (document) => {
          calls.push('v1-to-v3')
          return { ...document, version: 'v3', migratedToV3: true }
        }
      }
    ]
  })

  const migrated = registrar.load({ version: 'v1' })

  assert.equal(registrar.hooks.length, 1)
  assert.deepEqual(calls, ['v1-to-v3', 'v3-to-v8'])
  assert.deepEqual(migrated, {
    version: 'v8',
    migratedToV3: true,
    migratedToV8: true
  })
})

test('an unmatched string version is a normal terminal pass-through', async () => {
  const { registerAppVersionMigrations } = await loadExample()
  const registrar = createRegistrar()
  const calls = []
  registerAppVersionMigrations(registrar.core, {
    migrations: [
      {
        from: 'v1',
        to: 'v8',
        migrate: (document) => {
          calls.push('v1-to-v8')
          return { ...document, version: 'v8' }
        }
      }
    ]
  })
  const unknown = { version: 'legacy-x', title: 'App decides compatibility' }

  assert.equal(registrar.load(unknown), unknown)
  assert.deepEqual(calls, [])
})

test('a document in the middle invokes only the matching chain suffix', async () => {
  const { registerAppVersionMigrations } = await loadExample()
  const registrar = createRegistrar()
  const calls = []
  registerAppVersionMigrations(registrar.core, {
    migrations: [
      {
        from: 'v1',
        to: 'v3',
        migrate: (document) => {
          calls.push('v1-to-v3')
          return { ...document, version: 'v3' }
        }
      },
      {
        from: 'v3',
        to: 'v8',
        migrate: (document) => {
          calls.push('v3-to-v8')
          return { ...document, version: 'v8' }
        }
      }
    ]
  })

  assert.equal(registrar.load({ version: 'v3' }).version, 'v8')
  assert.deepEqual(calls, ['v3-to-v8'])
})

test('missing version remains an app eligibility failure', async () => {
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
})

test('each step must produce exactly its declared next version', async () => {
  const {
    APP_MIGRATION_ERROR_CODES,
    AppMigrationError,
    registerAppVersionMigrations
  } = await loadExample()
  const registrar = createRegistrar()
  registerAppVersionMigrations(registrar.core, {
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

test('a matched transform returning an invalid document is an invalid step result', async () => {
  const {
    APP_MIGRATION_ERROR_CODES,
    AppMigrationError,
    registerAppVersionMigrations
  } = await loadExample()
  const registrar = createRegistrar()
  registerAppVersionMigrations(registrar.core, {
    migrations: [
      {
        from: 'v1',
        to: 'v2',
        migrate: () => ({ title: 'missing migrated version' })
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

test('an asynchronous transform fails synchronously and contains rejection', async () => {
  const {
    APP_MIGRATION_ERROR_CODES,
    AppMigrationError,
    registerAppVersionMigrations
  } = await loadExample()
  const registrar = createRegistrar()
  const asynchronousFailure = new Error('async migration rejected')
  const rejectedResult = Promise.reject(asynchronousFailure)
  const originalCatch = rejectedResult.catch.bind(rejectedResult)
  let catchCalls = 0
  rejectedResult.catch = (...args) => {
    catchCalls += 1
    return originalCatch(...args)
  }
  registerAppVersionMigrations(registrar.core, {
    migrations: [
      {
        from: 'v1',
        to: 'v2',
        migrate: () => rejectedResult
      }
    ]
  })

  assert.throws(
    () => registrar.load({ version: 'v1' }),
    (error) =>
      error instanceof AppMigrationError &&
      error.code === APP_MIGRATION_ERROR_CODES.ASYNC_UNSUPPORTED
  )
  const containedByDispatcher = catchCalls
  if (containedByDispatcher === 0) {
    await originalCatch(() => undefined)
  }
  assert.equal(containedByDispatcher, 1)
})

test('empty migration batch installs no Core load hook', async () => {
  const { registerAppVersionMigrations } = await loadExample()
  const registrar = createRegistrar()

  registerAppVersionMigrations(registrar.core, { migrations: [] })

  assert.equal(registrar.hooks.length, 0)
})

test('invalid migration graphs fail atomically before Core registration', async () => {
  const {
    APP_MIGRATION_ERROR_CODES,
    AppMigrationError,
    registerAppVersionMigrations
  } = await loadExample()
  const identity = (to) => (document) => ({ ...document, version: to })
  const cases = [
    {
      name: 'duplicate source or branch',
      migrations: [
        { from: 'v1', to: 'v2', migrate: identity('v2') },
        { from: 'v1', to: 'v3', migrate: identity('v3') }
      ]
    },
    {
      name: 'duplicate target or merge',
      migrations: [
        { from: 'v1', to: 'v3', migrate: identity('v3') },
        { from: 'v2', to: 'v3', migrate: identity('v3') }
      ]
    },
    {
      name: 'self transition',
      migrations: [{ from: 'v1', to: 'v1', migrate: identity('v1') }]
    },
    {
      name: 'disconnected components',
      migrations: [
        { from: 'v1', to: 'v2', migrate: identity('v2') },
        { from: 'v3', to: 'v4', migrate: identity('v4') }
      ]
    },
    {
      name: 'cycle',
      migrations: [
        { from: 'v1', to: 'v2', migrate: identity('v2') },
        { from: 'v2', to: 'v1', migrate: identity('v1') }
      ]
    }
  ]

  cases.forEach(({ name, migrations }) => {
    const registrar = createRegistrar()
    assert.throws(
      () => registerAppVersionMigrations(registrar.core, { migrations }),
      (error) =>
        error instanceof AppMigrationError &&
        error.code === APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
      name
    )
    assert.equal(registrar.hooks.length, 0, name)
  })
})

test('missing or invalid migration batch options fail atomically with an app error', async () => {
  const {
    APP_MIGRATION_ERROR_CODES,
    AppMigrationError,
    registerAppVersionMigrations
  } = await loadExample()
  const cases = [
    undefined,
    null,
    {},
    { migrations: null },
    { migrations: {} }
  ]

  cases.forEach((options) => {
    const registrar = createRegistrar()
    assert.throws(
      () => registerAppVersionMigrations(registrar.core, options),
      (error) =>
        error instanceof AppMigrationError &&
        error.code === APP_MIGRATION_ERROR_CODES.INVALID_CHAIN
    )
    assert.equal(registrar.hooks.length, 0)
  })
})

test('a sparse migration batch is rejected before Core registration', async () => {
  const {
    APP_MIGRATION_ERROR_CODES,
    AppMigrationError,
    registerAppVersionMigrations
  } = await loadExample()
  const registrar = createRegistrar()
  const migrations = new Array(2)
  migrations[1] = {
    from: 'v1',
    to: 'v2',
    migrate: (document) => ({ ...document, version: 'v2' })
  }

  assert.throws(
    () => registerAppVersionMigrations(registrar.core, { migrations }),
    (error) =>
      error instanceof AppMigrationError &&
      error.code === APP_MIGRATION_ERROR_CODES.INVALID_CHAIN
  )
  assert.equal(registrar.hooks.length, 0)
})

test('every dense migration slot must contain one complete transition', async () => {
  const {
    APP_MIGRATION_ERROR_CODES,
    AppMigrationError,
    registerAppVersionMigrations
  } = await loadExample()
  const migrate = (document) => ({ ...document, version: 'v2' })
  const cases = [
    { name: 'undefined step', step: undefined },
    { name: 'missing source', step: { to: 'v2', migrate } },
    { name: 'empty source', step: { from: '', to: 'v2', migrate } },
    { name: 'non-string source', step: { from: 1, to: 'v2', migrate } },
    { name: 'missing target', step: { from: 'v1', migrate } },
    { name: 'empty target', step: { from: 'v1', to: '', migrate } },
    { name: 'non-string target', step: { from: 'v1', to: 2, migrate } },
    { name: 'missing transform', step: { from: 'v1', to: 'v2' } },
    {
      name: 'non-function transform',
      step: { from: 'v1', to: 'v2', migrate: 'not a function' }
    }
  ]

  cases.forEach(({ name, step }) => {
    const registrar = createRegistrar()
    assert.throws(
      () =>
        registerAppVersionMigrations(registrar.core, {
          migrations: [step]
        }),
      (error) =>
        error instanceof AppMigrationError &&
        error.code === APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
      name
    )
    assert.equal(registrar.hooks.length, 0, name)
  })
})

test('a Core instance accepts only one non-empty dispatcher installation', async () => {
  const {
    APP_MIGRATION_ERROR_CODES,
    AppMigrationError,
    registerAppVersionMigrations
  } = await loadExample()
  const registrar = createRegistrar()
  registerAppVersionMigrations(registrar.core, {
    migrations: [
      {
        from: 'v1',
        to: 'v3',
        migrate: (document) => ({ ...document, version: 'v3' })
      }
    ]
  })

  assert.throws(
    () =>
      registerAppVersionMigrations(registrar.core, {
        migrations: [
          {
            from: 'v3',
            to: 'v8',
            migrate: (document) => ({ ...document, version: 'v8' })
          }
        ]
      }),
    (error) =>
      error instanceof AppMigrationError &&
      error.code === APP_MIGRATION_ERROR_CODES.ALREADY_REGISTERED
  )
  assert.equal(registrar.hooks.length, 1)
  assert.equal(registrar.load({ version: 'v1' }).version, 'v3')
})

test('empty batches do not claim the isolated per-Core installation slot', async () => {
  const { registerAppVersionMigrations } = await loadExample()
  const first = createRegistrar()
  const second = createRegistrar()

  registerAppVersionMigrations(first.core, { migrations: [] })
  registerAppVersionMigrations(first.core, {
    migrations: [
      {
        from: 'v1',
        to: 'v2',
        migrate: (document) => ({ ...document, version: 'v2' })
      }
    ]
  })
  registerAppVersionMigrations(first.core, { migrations: [] })
  registerAppVersionMigrations(second.core, {
    migrations: [
      {
        from: 'v1',
        to: 'v9',
        migrate: (document) => ({ ...document, version: 'v9' })
      }
    ]
  })

  assert.equal(first.hooks.length, 1)
  assert.equal(second.hooks.length, 1)
  assert.equal(first.load({ version: 'v1' }).version, 'v2')
  assert.equal(second.load({ version: 'v1' }).version, 'v9')
})

test('registration snapshots transition definitions and input order is irrelevant', async () => {
  const { registerAppVersionMigrations } = await loadExample()
  const registrar = createRegistrar()
  const first = {
    from: 'v1',
    to: 'v3',
    migrate: (document) => ({ ...document, version: 'v3' })
  }
  const second = {
    from: 'v3',
    to: 'v8',
    migrate: (document) => ({ ...document, version: 'v8' })
  }
  const migrations = [second, first]
  registerAppVersionMigrations(registrar.core, { migrations })

  migrations.reverse()
  first.from = 'mutated'
  first.migrate = (document) => ({ ...document, version: 'mutated' })

  assert.equal(registrar.load({ version: 'v1' }).version, 'v8')
})

test('a thrown registered transform remains a load-time migration failure', async () => {
  const { registerAppVersionMigrations } = await loadExample()
  const registrar = createRegistrar()
  const failure = new Error('domain migration failed')
  registerAppVersionMigrations(registrar.core, {
    migrations: [
      {
        from: 'v1',
        to: 'v8',
        migrate: () => {
          throw failure
        }
      }
    ]
  })

  assert.throws(
    () => registrar.load({ version: 'v1' }),
    (error) => error === failure
  )
})
