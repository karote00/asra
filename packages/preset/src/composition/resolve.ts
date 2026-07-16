import type { RenderEngineFactory } from '@asyra/render-engine'
import { createPixiRenderEngine } from '@asyra/render-engine-pixi'
import type {
  ApplyPresetOptions,
  PresetCapabilityBundle,
  PresetCoreAPIs,
  PresetDependencies
} from '../types'
import {
  DEFAULT_PRESET_ENGINE_ID,
  LEGACY_PRESET_ENGINE_FACTORY_ID,
  PRESET_COMPOSITION_ERROR_CODES
} from './constants'
import { createValidationError } from './error'

export interface ResolvedPresetComposition {
  dependencies: PresetDependencies
  engineId: string
  renderEngineFactory: RenderEngineFactory
  capabilityBundles: readonly PresetCapabilityBundle[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyIdentity = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value

const isPresetDependencies = (value: unknown): value is PresetDependencies =>
  isObject(value) &&
  isObject(value.sceneTree) &&
  isObject(value.systemContext) &&
  isObject(value.render) &&
  typeof value.render.setEngineFactory === 'function'

const describeBundleIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map((bundle) =>
    isObject(bundle) && typeof bundle.id === 'string'
      ? bundle.id
      : '<invalid-bundle>'
  )
}

const validateBundles = (value: unknown): readonly PresetCapabilityBundle[] => {
  if (value === undefined) return []
  const bundleIds = describeBundleIds(value)
  if (!Array.isArray(value)) {
    throw createValidationError({
      code: PRESET_COMPOSITION_ERROR_CODES.INVALID_COMPOSITION,
      message: 'Preset capabilityBundles must be an array',
      capabilityBundles: bundleIds,
      completedLayers: []
    })
  }

  const bundles = value.map((candidate) => {
    const id =
      isObject(candidate) && isNonEmptyIdentity(candidate.id)
        ? candidate.id
        : undefined
    const owner =
      isObject(candidate) && isObject(candidate.owner)
        ? candidate.owner
        : undefined
    const requires = isObject(candidate) ? candidate.requires : undefined
    const install = isObject(candidate) ? candidate.install : undefined

    if (
      !id ||
      !owner ||
      !isNonEmptyIdentity(owner.packageName) ||
      !isNonEmptyIdentity(owner.name) ||
      !Array.isArray(requires) ||
      !requires.every(isNonEmptyIdentity) ||
      new Set(requires).size !== requires.length ||
      typeof install !== 'function'
    ) {
      throw createValidationError({
        code: PRESET_COMPOSITION_ERROR_CODES.INVALID_COMPOSITION,
        message: `Capability bundle "${id ?? '<invalid-bundle>'}" is incomplete`,
        capabilityBundles: bundleIds,
        failedBundleId: id,
        completedLayers: []
      })
    }

    return candidate as unknown as PresetCapabilityBundle
  })

  const seen = new Set<string>()
  bundles.forEach((bundle) => {
    if (seen.has(bundle.id)) {
      throw createValidationError({
        code: PRESET_COMPOSITION_ERROR_CODES.DUPLICATE_TARGET,
        message: `Capability bundle target "${bundle.id}" is duplicated`,
        capabilityBundles: bundleIds,
        failedBundleId: bundle.id,
        completedLayers: []
      })
    }
    seen.add(bundle.id)
  })

  const indexById = new Map(
    bundles.map((bundle, index) => [bundle.id, index] as const)
  )
  bundles.forEach((bundle, bundleIndex) => {
    bundle.requires.forEach((dependencyId) => {
      const dependencyIndex = indexById.get(dependencyId)
      if (dependencyIndex === undefined) {
        throw createValidationError({
          code: PRESET_COMPOSITION_ERROR_CODES.MISSING_CAPABILITY_BUNDLE,
          message: `Capability bundle "${bundle.id}" requires missing bundle "${dependencyId}"`,
          capabilityBundles: bundleIds,
          failedBundleId: bundle.id,
          completedLayers: []
        })
      }
      if (dependencyIndex >= bundleIndex) {
        throw createValidationError({
          code: PRESET_COMPOSITION_ERROR_CODES.ORDERING_CONFLICT,
          message: `Capability bundle "${bundle.id}" requires "${dependencyId}" to appear earlier`,
          capabilityBundles: bundleIds,
          failedBundleId: bundle.id,
          completedLayers: []
        })
      }
    })
  })

  return [...bundles]
}

const resolveEngine = (
  options: ApplyPresetOptions,
  capabilityBundles: readonly PresetCapabilityBundle[]
): { engineId: string; renderEngineFactory: RenderEngineFactory } => {
  const bundleIds = capabilityBundles.map(({ id }) => id)
  if (
    options.renderEngineFactory !== undefined &&
    options.engine !== undefined
  ) {
    throw createValidationError({
      code: PRESET_COMPOSITION_ERROR_CODES.INVALID_COMPOSITION,
      message:
        'Configure either renderEngineFactory compatibility input or an identified engine bootstrap, not both',
      engineId:
        isObject(options.engine) && typeof options.engine.id === 'string'
          ? options.engine.id
          : undefined,
      capabilityBundles: bundleIds,
      completedLayers: []
    })
  }

  if (options.engine !== undefined) {
    if (!isObject(options.engine) || !isNonEmptyIdentity(options.engine.id)) {
      throw createValidationError({
        code: PRESET_COMPOSITION_ERROR_CODES.UNKNOWN_ENGINE_BOOTSTRAP,
        message: 'Preset engine bootstrap requires a stable non-empty id',
        capabilityBundles: bundleIds,
        completedLayers: []
      })
    }
    if (options.engine.id === DEFAULT_PRESET_ENGINE_ID) {
      if (options.engine.factory !== undefined) {
        throw createValidationError({
          code: PRESET_COMPOSITION_ERROR_CODES.INVALID_COMPOSITION,
          message: `Preset-owned engine bootstrap "${DEFAULT_PRESET_ENGINE_ID}" cannot be paired with a custom factory`,
          engineId: options.engine.id,
          capabilityBundles: bundleIds,
          completedLayers: []
        })
      }
      return {
        engineId: DEFAULT_PRESET_ENGINE_ID,
        renderEngineFactory: createPixiRenderEngine
      }
    }
    if (typeof options.engine.factory !== 'function') {
      throw createValidationError({
        code: PRESET_COMPOSITION_ERROR_CODES.UNKNOWN_ENGINE_BOOTSTRAP,
        message: `Unknown engine bootstrap "${options.engine.id}" has no factory`,
        engineId: options.engine.id,
        capabilityBundles: bundleIds,
        completedLayers: []
      })
    }
    return {
      engineId: options.engine.id,
      renderEngineFactory: options.engine.factory
    }
  }

  if (options.renderEngineFactory !== undefined) {
    if (typeof options.renderEngineFactory !== 'function') {
      throw createValidationError({
        code: PRESET_COMPOSITION_ERROR_CODES.INVALID_COMPOSITION,
        message: 'renderEngineFactory must be a function',
        capabilityBundles: bundleIds,
        completedLayers: []
      })
    }
    return {
      engineId: LEGACY_PRESET_ENGINE_FACTORY_ID,
      renderEngineFactory: options.renderEngineFactory
    }
  }

  return {
    engineId: DEFAULT_PRESET_ENGINE_ID,
    renderEngineFactory: createPixiRenderEngine
  }
}

export const resolvePresetComposition = (
  core: PresetCoreAPIs,
  dependenciesOrOptions?: PresetDependencies | ApplyPresetOptions
): ResolvedPresetComposition => {
  if (!dependenciesOrOptions) {
    return {
      dependencies: core.getPresetDependencies(),
      engineId: DEFAULT_PRESET_ENGINE_ID,
      renderEngineFactory: createPixiRenderEngine,
      capabilityBundles: []
    }
  }

  if (isPresetDependencies(dependenciesOrOptions)) {
    return {
      dependencies: dependenciesOrOptions,
      engineId: DEFAULT_PRESET_ENGINE_ID,
      renderEngineFactory: createPixiRenderEngine,
      capabilityBundles: []
    }
  }

  if (!isObject(dependenciesOrOptions)) {
    throw createValidationError({
      code: PRESET_COMPOSITION_ERROR_CODES.INVALID_COMPOSITION,
      message: 'Preset composition input must be an options object',
      capabilityBundles: [],
      completedLayers: []
    })
  }

  const options = dependenciesOrOptions as ApplyPresetOptions
  const capabilityBundles = validateBundles(options.capabilityBundles)
  const engine = resolveEngine(options, capabilityBundles)
  if (
    options.dependencies !== undefined &&
    !isPresetDependencies(options.dependencies)
  ) {
    throw createValidationError({
      code: PRESET_COMPOSITION_ERROR_CODES.INVALID_COMPOSITION,
      message: 'Preset dependencies are incomplete',
      engineId: engine.engineId,
      capabilityBundles: capabilityBundles.map(({ id }) => id),
      completedLayers: []
    })
  }
  return {
    dependencies: options.dependencies ?? core.getPresetDependencies(),
    ...engine,
    capabilityBundles
  }
}
