/**
 * Reusable app-owned document migration helper.
 *
 * Copy this module into an app and replace the example transition batch and
 * domain transforms. The framework owns only load-hook invocation; this module
 * owns the app's connected migration registry and schema history.
 *
 * @typedef {Record<string, unknown> & import('@asyra/persistence').VersionedLoadDocument} AppDocument
 * @typedef {{
 *   from: string,
 *   to: string,
 *   migrate: (document: AppDocument) => AppDocument
 * }} AppMigrationStep
 * @typedef {Pick<import('@asyra/core').Core, 'registerLoadHook'>} LoadHookRegistrar
 */

import {
  assertExampleResult,
  definePublicExample
} from './example-contract.mjs'

export const exampleDefinition = definePublicExample({
  id: 'app-versioned-load-migration',
  title: 'Migrate app documents before canonical apply',
  objective:
    'Register one connected app-owned version chain and reject invalid or asynchronous migration results before package owners apply data.',
  publicPackages: ['@asyra/core', '@asyra/persistence'],
  environment:
    'Supported browser/Core load composition with Node.js artifact verification',
  runCommand: 'yarn examples:run app-versioned-load-migration',
  sourceRegion: 'example',
  expectedResult:
    'A v1 document reaches v3 through one deterministic chain; invalid inputs fail before canonical apply.',
  ownership: {
    framework:
      'Core owns hook ordering and package-owner validation boundaries.',
    preset: 'Not composed in this example.',
    app: 'Owns document versions, migrations, and domain transforms.'
  }
})

export const APP_MIGRATION_ERROR_CODES = Object.freeze({
  INVALID_CHAIN: 'INVALID_CHAIN',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  MISSING_VERSION: 'MISSING_VERSION',
  INVALID_STEP_RESULT: 'INVALID_STEP_RESULT',
  ASYNC_UNSUPPORTED: 'ASYNC_UNSUPPORTED'
})

export class AppMigrationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {string | undefined} version
   */
  constructor(code, message, version) {
    super(message)
    this.name = 'AppMigrationError'
    this.code = code
    this.version = version
  }
}

/** @type {WeakSet<LoadHookRegistrar>} */
const migrationInstallations = new WeakSet()

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * @param {unknown} document
 * @returns {AppDocument}
 */
const requireVersionedDocument = (document) => {
  if (!isRecord(document) || typeof document.version !== 'string') {
    throw new AppMigrationError(
      APP_MIGRATION_ERROR_CODES.MISSING_VERSION,
      'App migration requires a string document version',
      undefined
    )
  }
  return /** @type {AppDocument} */ (document)
}

/**
 * @param {readonly AppMigrationStep[] | null | undefined} migrations
 * @returns {Map<string, AppMigrationStep>}
 */
const createConnectedMigrationRegistry = (migrations) => {
  /** @type {Map<string, AppMigrationStep>} */
  const byFrom = new Map()
  const incoming = new Set()

  if (!Array.isArray(migrations)) {
    throw new AppMigrationError(
      APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
      'App migrations must be registered as one complete array batch',
      undefined
    )
  }

  for (const [index, step] of migrations.entries()) {
    if (
      !step ||
      typeof step.from !== 'string' ||
      step.from.length === 0 ||
      typeof step.to !== 'string' ||
      step.to.length === 0 ||
      typeof step.migrate !== 'function'
    ) {
      throw new AppMigrationError(
        APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
        `Migration step ${index} must declare non-empty from/to versions and a migrate function`,
        undefined
      )
    }
    if (step.from === step.to) {
      throw new AppMigrationError(
        APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
        `Migration step ${index} cannot transition ${step.from} to itself`,
        step.from
      )
    }
    if (byFrom.has(step.from)) {
      throw new AppMigrationError(
        APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
        `Migration chain has multiple transitions from ${step.from}`,
        step.from
      )
    }
    if (incoming.has(step.to)) {
      throw new AppMigrationError(
        APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
        `Migration chain has multiple transitions to ${step.to}`,
        step.to
      )
    }

    const snapshot = {
      from: step.from,
      to: step.to,
      migrate: step.migrate
    }
    byFrom.set(snapshot.from, snapshot)
    incoming.add(snapshot.to)
  }

  if (byFrom.size === 0) {
    return byFrom
  }

  const heads = [...byFrom.values()].filter((step) => !incoming.has(step.from))
  if (heads.length !== 1) {
    throw new AppMigrationError(
      APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
      'Migration chain must have exactly one head and cannot contain a cycle',
      undefined
    )
  }

  const visited = new Set()
  let currentVersion = heads[0].from
  while (byFrom.has(currentVersion)) {
    if (visited.has(currentVersion)) {
      throw new AppMigrationError(
        APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
        `Migration chain contains a cycle at ${currentVersion}`,
        currentVersion
      )
    }
    visited.add(currentVersion)
    currentVersion = /** @type {AppMigrationStep} */ (
      byFrom.get(currentVersion)
    ).to
  }

  if (visited.size !== byFrom.size) {
    throw new AppMigrationError(
      APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
      'Migration chain contains a disconnected component',
      undefined
    )
  }

  return byFrom
}

/**
 * Validate one app-owned migration chain and register one conditional
 * dispatcher on a Core instance.
 *
 * @param {LoadHookRegistrar} core
 * @param {{
 *   migrations: readonly AppMigrationStep[]
 * }} options
 */
// #region example
export const registerAppVersionMigrations = (core, options) => {
  const registry = createConnectedMigrationRegistry(options?.migrations)
  if (registry.size === 0) {
    return
  }
  if (migrationInstallations.has(core)) {
    throw new AppMigrationError(
      APP_MIGRATION_ERROR_CODES.ALREADY_REGISTERED,
      'This app migration helper already installed a dispatcher on the Core instance',
      undefined
    )
  }

  core.registerLoadHook((rawDocument) => {
    let document = requireVersionedDocument(rawDocument)
    const visited = new Set()

    while (registry.has(document.version)) {
      if (visited.has(document.version)) {
        throw new AppMigrationError(
          APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
          `Migration dispatch encountered a cycle at ${document.version}`,
          document.version
        )
      }
      visited.add(document.version)

      const step = /** @type {AppMigrationStep} */ (
        registry.get(document.version)
      )
      const migrated = /** @type {unknown} */ (step.migrate(document))
      if (
        isRecord(migrated) &&
        'then' in migrated &&
        typeof migrated.then === 'function'
      ) {
        void Promise.resolve(migrated).catch(() => undefined)
        throw new AppMigrationError(
          APP_MIGRATION_ERROR_CODES.ASYNC_UNSUPPORTED,
          `Migration from ${step.from} returned an unsupported asynchronous result`,
          step.from
        )
      }
      if (!isRecord(migrated) || typeof migrated.version !== 'string') {
        throw new AppMigrationError(
          APP_MIGRATION_ERROR_CODES.INVALID_STEP_RESULT,
          `Migration from ${step.from} must return a document with version ${step.to}`,
          undefined
        )
      }

      const migratedVersion = migrated.version
      if (migratedVersion !== step.to) {
        throw new AppMigrationError(
          APP_MIGRATION_ERROR_CODES.INVALID_STEP_RESULT,
          `Migration from ${step.from} must produce version ${step.to}`,
          migratedVersion
        )
      }

      document = /** @type {AppDocument} */ (migrated)
    }

    return document
  })
  migrationInstallations.add(core)
}

/**
 * Copyable example only: replace these app schema fields with the product's
 * actual domain transforms.
 *
 * @param {LoadHookRegistrar} core
 */
export const installExampleAppMigrations = (core) => {
  registerAppVersionMigrations(core, {
    migrations: [
      {
        from: 'v1',
        to: 'v2',
        migrate: (document) => {
          const { legacyTitle, ...rest } = document
          return {
            ...rest,
            version: 'v2',
            title: typeof legacyTitle === 'string' ? legacyTitle : ''
          }
        }
      },
      {
        from: 'v2',
        to: 'v3',
        migrate: (document) => ({
          ...document,
          version: 'v3',
          metadata: {
            ...(isRecord(document.metadata) ? document.metadata : {}),
            schema: 'v3'
          }
        })
      }
    ]
  })
}
// #endregion example

export const runExample = () => {
  /** @type {Array<(document: unknown) => unknown>} */
  const hooks = []
  const registrar = {
    /** @param {(document: unknown) => unknown} hook */
    registerLoadHook: (hook) => hooks.push(hook)
  }
  installExampleAppMigrations(registrar)
  /** @param {unknown} document */
  const load = (document) =>
    hooks.reduce((current, hook) => hook(current), document)
  const migrated = /** @type {AppDocument} */ (
    load({ version: 'v1', legacyTitle: 'Document' })
  )
  let invalidCode
  try {
    load({ legacyTitle: 'Missing version' })
  } catch (error) {
    invalidCode = error instanceof AppMigrationError ? error.code : undefined
  }

  assertExampleResult(migrated.version === 'v3', 'migration reaches v3')
  assertExampleResult(
    isRecord(migrated.metadata) && migrated.metadata.schema === 'v3',
    'terminal schema is produced'
  )
  assertExampleResult(
    invalidCode === APP_MIGRATION_ERROR_CODES.MISSING_VERSION,
    'invalid data fails before canonical apply'
  )
  return Object.freeze({ invalidCode, migrated })
}
