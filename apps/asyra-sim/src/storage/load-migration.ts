import { ComponentTypes, PropertyTypes } from '../constants'
import { isPlainRecord } from '../domain/records'

// Retained wire data, not runtime aliases. New saves use the current identities.
export const LEGACY_PROJECT_FORMAT = 'asyra-sim-project'
export const LEGACY_TRAJECTORY_FORMAT = 'asyra-sim-trajectory'
// The App explicitly keeps this database identity; the reusable repository has
// a neutral default. Do not rename or relocate existing origin-local data.
export const EXISTING_APP_DATABASE = 'asyra-sim-local-v1'

const componentTypes = new Map([
  ['asyra-sim-body', ComponentTypes.BODY],
  ['asyra-sim-candidate', ComponentTypes.CANDIDATE],
  ['asyra-sim-experiment', ComponentTypes.EXPERIMENT],
  ['asyra-sim-run-reference', ComponentTypes.RUN_REFERENCE]
])
const propertyTypes = new Map([
  ['asyra-sim-body-properties', PropertyTypes.BODY],
  ['asyra-sim-candidate-properties', PropertyTypes.CANDIDATE],
  ['asyra-sim-experiment-properties', PropertyTypes.EXPERIMENT],
  ['asyra-sim-run-reference-properties', PropertyTypes.RUN_REFERENCE]
])

function migrateTypes(value: unknown, names: ReadonlyMap<string, string>) {
  if (!isPlainRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([id, entry]) => {
      if (!isPlainRecord(entry) || typeof entry.type !== 'string')
        return [id, entry]
      const type = names.get(entry.type)
      return [id, type ? { ...entry, type } : entry]
    })
  )
}

/** Normalize only known type slots before the ordinary project validation. */
export function migrateProjectDocument(value: unknown): unknown {
  if (!isPlainRecord(value) || value.version !== '1.0.0') return value
  return {
    ...value,
    props: migrateTypes(value.props, propertyTypes),
    sceneTree: isPlainRecord(value.sceneTree)
      ? {
          ...value.sceneTree,
          elements: migrateTypes(value.sceneTree.elements, componentTypes)
        }
      : value.sceneTree
  }
}
