/**
 * Reusable app-owned document migration helper.
 *
 * Copy this module into an app and replace the example version list and domain
 * transforms. The framework owns only ordered hook invocation; this module owns
 * the app's supported versions and schema history.
 *
 * @typedef {Record<string, unknown> & import('@asyra/persistence').VersionedLoadDocument} AppDocument
 * @typedef {{
 *   from: string,
 *   to: string,
 *   migrate: (document: AppDocument) => AppDocument
 * }} AppMigrationStep
 * @typedef {Pick<import('@asyra/core').Core, 'registerLoadHook'>} LoadHookRegistrar
 */

export const APP_MIGRATION_ERROR_CODES = Object.freeze({
  INVALID_CHAIN: 'INVALID_CHAIN',
  MISSING_VERSION: 'MISSING_VERSION',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  INVALID_STEP_RESULT: 'INVALID_STEP_RESULT'
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
 * @param {readonly string[]} versions
 * @param {readonly AppMigrationStep[]} migrations
 */
const assertAdjacentChain = (versions, migrations) => {
  const uniqueVersions = new Set(versions)
  if (
    versions.length === 0 ||
    uniqueVersions.size !== versions.length ||
    migrations.length !== versions.length - 1
  ) {
    throw new AppMigrationError(
      APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
      'App migration versions must be unique and have one adjacent step per version transition',
      undefined
    )
  }

  migrations.forEach((step, index) => {
    if (step.from !== versions[index] || step.to !== versions[index + 1]) {
      throw new AppMigrationError(
        APP_MIGRATION_ERROR_CODES.INVALID_CHAIN,
        `Migration step ${index} must declare ${versions[index]} -> ${versions[index + 1]}`,
        undefined
      )
    }
  })
}

/**
 * Register app-owned adjacent migration steps on one Core instance.
 *
 * @param {LoadHookRegistrar} core
 * @param {{
 *   versions: readonly string[],
 *   migrations: readonly AppMigrationStep[]
 * }} options
 */
export const registerAppVersionMigrations = (core, options) => {
  const versions = [...options.versions]
  const migrations = [...options.migrations]
  assertAdjacentChain(versions, migrations)

  migrations.forEach((step, stepIndex) => {
    core.registerLoadHook((rawDocument) => {
      const document = requireVersionedDocument(rawDocument)
      const version = document.version
      const versionIndex = versions.indexOf(version)
      if (versionIndex === -1) {
        throw new AppMigrationError(
          APP_MIGRATION_ERROR_CODES.UNSUPPORTED_VERSION,
          `Unsupported app document version: ${version}`,
          version
        )
      }

      if (versionIndex > stepIndex) {
        return document
      }

      if (versionIndex < stepIndex) {
        throw new AppMigrationError(
          APP_MIGRATION_ERROR_CODES.INVALID_STEP_RESULT,
          `Migration chain did not advance to ${step.from} before step ${stepIndex}`,
          version
        )
      }

      const migrated = step.migrate(document)
      const migratedVersion = requireVersionedDocument(migrated).version
      if (migratedVersion !== step.to) {
        throw new AppMigrationError(
          APP_MIGRATION_ERROR_CODES.INVALID_STEP_RESULT,
          `Migration step ${stepIndex} must produce version ${step.to}`,
          migratedVersion
        )
      }
      return migrated
    })
  })
}

/**
 * Copyable example only: replace these app schema fields with the product's
 * actual domain transforms.
 *
 * @param {LoadHookRegistrar} core
 */
export const installExampleAppMigrations = (core) => {
  registerAppVersionMigrations(core, {
    versions: ['v1', 'v2', 'v3'],
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
