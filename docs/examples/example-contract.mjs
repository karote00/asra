/**
 * @type {Array<
 *   'id' | 'title' | 'objective' | 'environment' | 'runCommand' |
 *   'sourceRegion' | 'expectedResult'
 * >}
 */
const REQUIRED_TEXT_FIELDS = [
  'id',
  'title',
  'objective',
  'environment',
  'runCommand',
  'sourceRegion',
  'expectedResult'
]

/**
 * @typedef {object} PublicExampleDefinition
 * @property {string} id
 * @property {string} title
 * @property {string} objective
 * @property {string} environment
 * @property {string} runCommand
 * @property {string} sourceRegion
 * @property {string} expectedResult
 * @property {string[]} publicPackages
 * @property {{framework: string, preset: string, app: string}} ownership
 */

/** @param {unknown} value */
const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  Object.values(value).forEach(freeze)
  return value
}

/**
 * @template {PublicExampleDefinition} T
 * @param {T} definition
 * @returns {Readonly<T>}
 */
export const definePublicExample = (definition) => {
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (typeof definition?.[field] !== 'string' || !definition[field].trim()) {
      throw new Error(`Public example requires non-empty ${field}`)
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(definition.id)) {
    throw new Error(`Invalid public example id: ${definition.id}`)
  }
  if (
    !Array.isArray(definition.publicPackages) ||
    definition.publicPackages.length === 0 ||
    definition.publicPackages.some(
      (packageName) =>
        typeof packageName !== 'string' || !packageName.startsWith('@asyra/')
    )
  ) {
    throw new Error(`${definition.id} requires public @asyra package roots`)
  }
  /** @type {Array<'framework' | 'preset' | 'app'>} */
  const ownershipKeys = ['framework', 'preset', 'app']
  for (const owner of ownershipKeys) {
    if (typeof definition.ownership?.[owner] !== 'string') {
      throw new Error(`${definition.id} requires an ownership.${owner} map`)
    }
  }
  if ('version' in definition || 'versions' in definition) {
    throw new Error(`${definition.id} cannot own package versions`)
  }
  return /** @type {Readonly<T>} */ (
    freeze({
      ...definition,
      publicPackages: [...new Set(definition.publicPackages)]
    })
  )
}

/**
 * @param {unknown} condition
 * @param {string} message
 */
export const assertExampleResult = (condition, message) => {
  if (!condition) {
    throw new Error(`Example result contract failed: ${message}`)
  }
}
