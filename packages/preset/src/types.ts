import type { CorePresetDependencies, CorePresetInstallAPIs } from '@asyra/core'
import type { RenderEngineFactory } from '@asyra/render-engine'
import type { RegistrationOwnerMetadata, RegistrationRef } from '@asyra/utils'
import type { PresetCompositionErrorCode } from './composition/constants'

export type { PresetCompositionErrorCode } from './composition/constants'

export type PresetDependencies = CorePresetDependencies
export type PresetCoreAPIs = CorePresetInstallAPIs

export interface PresetApplicationDisposeSuccess {
  ok: true
  operation: 'dispose-preset'
  removed: readonly RegistrationRef[]
  skipped: readonly RegistrationRef[]
}

export interface PresetCompositionSuccess {
  ok: true
  state: 'completed'
  engineId: string
  sharedGroups: readonly string[]
  capabilityBundles: readonly string[]
  order: readonly string[]
}

export interface PresetApplication {
  readonly result: PresetCompositionSuccess
  dispose(): PresetApplicationDisposeSuccess
}

export interface PresetEngineBootstrap {
  id: string
  factory?: RenderEngineFactory
}

export interface PresetCapabilityBundleContext {
  core: PresetCoreAPIs
  dependencies: PresetDependencies
  engineId: string
}

export interface PresetCapabilityInstallation {
  outputs: readonly string[]
  dispose(): void
}

export interface PresetCapabilityBundle {
  id: string
  owner: RegistrationOwnerMetadata
  requires: readonly string[]
  install(context: PresetCapabilityBundleContext): PresetCapabilityInstallation
}

export interface ApplyPresetOptions {
  dependencies?: PresetDependencies
  renderEngineFactory?: RenderEngineFactory
  engine?: PresetEngineBootstrap
  capabilityBundles?: readonly PresetCapabilityBundle[]
}

export type PresetCompositionLayer =
  | 'validation'
  | 'shared-defaults'
  | 'concrete-engine'
  | 'capability-bundle'
  | 'cleanup'

export type PresetCompositionCleanupState =
  | 'not-required'
  | 'completed'
  | 'pending'

export interface PresetCompositionCleanupResult {
  state: PresetCompositionCleanupState
  completed: readonly string[]
  pending: readonly string[]
}

export interface PresetCompositionFailureResult {
  ok: false
  code: PresetCompositionErrorCode
  operation: 'apply-preset'
  message: string
  layer: PresetCompositionLayer
  engineId?: string
  capabilityBundles: readonly string[]
  failedBundleId?: string
  completedLayers: readonly string[]
  cleanup: PresetCompositionCleanupResult
  cause?: unknown
}
