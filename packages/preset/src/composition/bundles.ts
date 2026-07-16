import type {
  PresetCapabilityBundle,
  PresetCapabilityInstallation,
  PresetCoreAPIs,
  PresetDependencies
} from '../types'
import { createLayerInstallError } from './error'

export interface CompletedCapabilityBundleInstallation {
  id: string
  owner: {
    packageName: string
    name: string
  }
  outputs: readonly string[]
}

interface InstallCapabilityBundlesOptions {
  core: PresetCoreAPIs
  dependencies: PresetDependencies
  engineId: string
  bundles: readonly PresetCapabilityBundle[]
  completedLayers: readonly string[]
  registerCleanup(key: string, dispose: () => void): void
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStableOutput = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value

const describeLayerFailure = (
  bundle: PresetCapabilityBundle,
  engineId: string,
  bundles: readonly PresetCapabilityBundle[],
  completedLayers: readonly string[],
  message: string,
  cause?: unknown
) =>
  createLayerInstallError({
    message,
    layer: 'capability-bundle',
    engineId,
    capabilityBundles: bundles.map(({ id }) => id),
    failedBundleId: bundle.id,
    completedLayers,
    cause
  })

export const installCapabilityBundles = ({
  core,
  dependencies,
  engineId,
  bundles,
  completedLayers,
  registerCleanup
}: InstallCapabilityBundlesOptions): readonly CompletedCapabilityBundleInstallation[] => {
  const installations: CompletedCapabilityBundleInstallation[] = []

  bundles.forEach((bundle) => {
    const layersBeforeBundle = [
      ...completedLayers,
      ...installations.map(({ id }) => `capability-bundle:${id}`)
    ]
    let value: PresetCapabilityInstallation
    try {
      value = bundle.install({ core, dependencies, engineId })
    } catch (cause) {
      throw describeLayerFailure(
        bundle,
        engineId,
        bundles,
        layersBeforeBundle,
        `Capability bundle "${bundle.id}" failed to install`,
        cause
      )
    }

    if (!isObject(value) || typeof value.dispose !== 'function') {
      throw describeLayerFailure(
        bundle,
        engineId,
        bundles,
        layersBeforeBundle,
        `Capability bundle "${bundle.id}" returned no cleanup owner`
      )
    }

    const disposeBundle = value.dispose.bind(value)
    registerCleanup(`capability-bundle:${bundle.id}`, disposeBundle)

    if (
      !Array.isArray(value.outputs) ||
      value.outputs.length === 0 ||
      !value.outputs.every(isStableOutput) ||
      new Set(value.outputs).size !== value.outputs.length
    ) {
      throw describeLayerFailure(
        bundle,
        engineId,
        bundles,
        layersBeforeBundle,
        `Capability bundle "${bundle.id}" returned invalid installation outputs`
      )
    }

    installations.push({
      id: bundle.id,
      owner: { ...bundle.owner },
      outputs: [...value.outputs]
    })
  })

  return installations
}
