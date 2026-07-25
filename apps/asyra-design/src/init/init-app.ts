import { applyPreset } from '@asyra/preset'
import core from '../contexts'
import { initAreaSelection } from './capabilities/init-area-selection'
import { initGradientFillEditing } from './capabilities/init-gradient-fill-editing'
import { initVectorIconData } from './capabilities/init-vector-icon-data'
import { initLoadDiagnostics } from './diagnostics/init-load-diagnostics'
import { initCanvasPipelineDebugger } from './diagnostics/init-canvas-pipeline-debugger'
import { initSelectionCompatibility } from './derived-state/init-selection-compatibility'
import { initPathEditingContinuation } from './derived-state/init-path-editing-continuation'
import { initFeatures } from './foundation/init-features'
import { initInputSystem } from './foundation/init-input-system'
import { elementApis } from '../common-apis/element'
import { hierarchyApis } from '../common-apis/hierarchy'
import { strokeApis } from '../common-apis/strokes'
import {
  composeAiAgentRuntime,
  type AiRuntimeComposition,
  type ComposeAiAgentRuntimeOptions
} from '../ai/composition'

export interface InitAppOptions {
  ai?: ComposeAiAgentRuntimeOptions
}

export interface AppInitialization {
  readonly aiRuntime: AiRuntimeComposition
  dispose(): Promise<void>
}

/**
 * Initializes all framework components and configurations.
 *
 * This is the single entry point for setting up the Asyra framework in your app.
 * Users can extend this function to add custom initialization logic, runtime scripts,
 * or redefine behaviors.
 *
 * Example extension:
 * ```typescript
 * import { initApp as baseInitApp } from './init'
 *
 * export const initApp = () => {
 *   // Initialize base framework
 *   const initialization = baseInitApp()
 *
 *   // Add custom initialization
 *   customInputHandlers()
 *   customBehaviors()
 *
 *   return initialization
 * }
 * ```
 */
export const initApp = (options: InitAppOptions = {}): AppInitialization => {
  applyPreset(core)

  // DEV runtime diagnostics are loaded from an optional package subpath.
  void initCanvasPipelineDebugger()

  // Diagnostics: subscribe once to core load diagnostics and route reports to app-level handlers.
  initLoadDiagnostics()

  // Derived-state syncs.
  // Keep selectedVectorPoint mirrored from SelectionManager-driven UI state.
  initSelectionCompatibility()
  initPathEditingContinuation()

  // Capability init.
  initAreaSelection()
  initGradientFillEditing()
  initVectorIconData()

  // Foundation init.
  initInputSystem()
  const aiRuntime = composeAiAgentRuntime(
    options.ai ?? {
      enabled: false
    }
  )
  // Initialize feature-system for application-level features
  initFeatures()

  if (import.meta.env.DEV) {
    window.__AsyraE2E__ = {
      elementApis,
      hierarchyApis,
      strokeApis
    }
  }

  return Object.freeze({
    aiRuntime,
    dispose: () => aiRuntime.dispose()
  })
}
