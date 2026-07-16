import {
  ExtensionRegistry,
  type ExtensionOperationFailure,
  type ExtensionOperationResult,
  type ExtensionTargetMetadata
} from '@asyra/utils'
import { PropertyTypes } from '@asyra/utils'
import { DEFAULT_PROPERTY_COMPONENT_DEFINITIONS } from './props/components'
import { DEFAULT_PROPERTY_SCHEMAS } from './props/register-property-schemas'
import type {
  PresetExtension,
  PresetExtensionContext,
  PresetExtensionRegistry
} from './types'

export const PRESET_EXTENSION_OWNER = Object.freeze({
  packageName: '@asyra/preset',
  name: 'default-preset'
})

const propertySchemaTargetKey = (type: string) =>
  `preset.property.schema:${type}`
const propertyRuntimeTargetKey = (type: string) =>
  `preset.property.runtime:${type}`

const PROPERTY_SCHEMA_TARGETS = Object.freeze(
  Object.fromEntries(
    DEFAULT_PROPERTY_SCHEMAS.map(({ type }) => [
      type,
      propertySchemaTargetKey(type)
    ])
  ) as Readonly<Record<string, string>>
)

const PROPERTY_RUNTIME_TARGETS = Object.freeze(
  Object.fromEntries(
    DEFAULT_PROPERTY_COMPONENT_DEFINITIONS.map(({ type }) => [
      type,
      propertyRuntimeTargetKey(type)
    ])
  ) as Readonly<Record<string, string>>
)

export const PRESET_EXTENSION_TARGETS = Object.freeze({
  PROPERTY_SCHEMAS: PROPERTY_SCHEMA_TARGETS,
  PROPERTY_RUNTIMES: PROPERTY_RUNTIME_TARGETS,
  FEATURE_REGISTRATIONS: 'preset.feature.registrations'
})

const PROPERTY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  [PropertyTypes.POSITION]: 'Position',
  [PropertyTypes.DIMENSION]: 'Dimension',
  [PropertyTypes.CUSTOM]: 'Custom',
  [PropertyTypes.FILL]: 'Fill',
  [PropertyTypes.FILLS]: 'Fills',
  [PropertyTypes.STROKE]: 'Stroke',
  [PropertyTypes.STROKES]: 'Strokes',
  [PropertyTypes.ANCHOR_POINT]: 'Anchor point',
  [PropertyTypes.ANCHOR_POINTS]: 'Anchor points',
  [PropertyTypes.VECTOR_POINT]: 'Vector point',
  [PropertyTypes.VECTOR_POINTS]: 'Vector points',
  [PropertyTypes.VECTOR_SEGMENT]: 'Vector segment',
  [PropertyTypes.VECTOR_SEGMENTS]: 'Vector segments',
  [PropertyTypes.VECTOR_NETWORK]: 'Vector network',
  [PropertyTypes.VECTOR_NETWORKS]: 'Vector networks'
})

const propertyName = (type: string) => PROPERTY_NAMES[type] ?? type

const assertCleanupResult = (
  result: ExtensionOperationResult | { ok: boolean; code?: string },
  targetKey: string
): void => {
  if (result.ok) {
    return
  }

  const failureResult = result as Partial<ExtensionOperationFailure>
  throw new Error(
    `Preset target "${targetKey}" cleanup failed: ${failureResult.code ?? 'UNKNOWN'}`
  )
}

export const createPresetExtensionRegistry = (): PresetExtensionRegistry => {
  const registry = new ExtensionRegistry<PresetExtensionContext>()

  DEFAULT_PROPERTY_SCHEMAS.forEach((schema) => {
    const targetKey = propertySchemaTargetKey(schema.type)
    registry.registerTarget({
      key: targetKey,
      name: `${propertyName(schema.type)} property schema`,
      kind: 'property-schema',
      owner: PRESET_EXTENSION_OWNER,
      supportedStrategies: ['replace'],
      install: ({ core }) => {
        core.registerPropertySchema(schema)
        return () => {
          assertCleanupResult(
            core.unregisterPropertyRegistration(schema.type, 'schema'),
            targetKey
          )
        }
      }
    })
  })

  DEFAULT_PROPERTY_COMPONENT_DEFINITIONS.forEach((definition) => {
    const targetKey = propertyRuntimeTargetKey(definition.type)
    registry.registerTarget({
      key: targetKey,
      name: `${propertyName(definition.type)} property runtime`,
      kind: 'property-runtime',
      owner: PRESET_EXTENSION_OWNER,
      supportedStrategies: ['replace'],
      install: ({ core }) => {
        core.definePropertyComponent(definition)
        return () => {
          assertCleanupResult(
            core.unregisterPropertyRegistration(definition.type, 'runtime'),
            targetKey
          )
        }
      }
    })
  })

  registry.registerTarget({
    key: PRESET_EXTENSION_TARGETS.FEATURE_REGISTRATIONS,
    name: 'App feature registrations',
    kind: 'feature-registration',
    owner: PRESET_EXTENSION_OWNER,
    supportedStrategies: ['before', 'after', 'append', 'replace'],
    install: () => () => undefined
  })

  return registry
}

export const registerPresetExtensions = (
  registry: PresetExtensionRegistry,
  extensions: readonly PresetExtension[]
): void => {
  extensions.forEach((extension) => registry.registerExtension(extension))
}

export const getPresetExtensionTargets = (): ExtensionTargetMetadata[] =>
  createPresetExtensionRegistry().getTargets()

export const getPresetExtensionTarget = (
  key: string
): ExtensionTargetMetadata | undefined =>
  createPresetExtensionRegistry().getTarget(key)
