import type { CorePresetDependencies, CorePresetInstallAPIs } from '@asyra/core'
import type { RenderEngineFactory } from '@asyra/render-engine'
import type {
  ExtensionRegistration,
  ExtensionRegistry,
  ExtensionRegistryApplication
} from '@asyra/utils'

export type PresetDependencies = CorePresetDependencies
export type PresetCoreAPIs = CorePresetInstallAPIs

export interface PresetExtensionContext {
  core: PresetCoreAPIs
  dependencies: PresetDependencies
}

export type PresetExtension = ExtensionRegistration<PresetExtensionContext>
export type PresetExtensionRegistry = ExtensionRegistry<PresetExtensionContext>
export type PresetApplication =
  ExtensionRegistryApplication<PresetExtensionContext>

export interface ApplyPresetOptions {
  dependencies?: PresetDependencies
  renderEngineFactory?: RenderEngineFactory
  extensions?: readonly PresetExtension[]
}
