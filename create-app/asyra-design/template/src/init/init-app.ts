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
import type { AiAgentFeatureRuntime } from '../features/ai-agent'
import {
  createAsyraDesignAiConversationController,
  type AsyraDesignAiConversationController
} from '../ai/conversation'
import type { AsyraDesignAiConfirmationBroker } from '../ai/confirmation'
import { createAsyraDesignAiStartup, type AsyraDesignAiMode } from '../ai/mode'
import type { AsyraDesignAiHistoryProjection } from '../common-apis/history'

export interface InitAppOptions {
  ai?: ComposeAiAgentRuntimeOptions
  aiMode?: AsyraDesignAiMode
}

export interface AppInitialization {
  readonly aiConfirmation: AsyraDesignAiConfirmationBroker | null
  readonly aiConversation: AsyraDesignAiConversationController | null
  readonly aiHistory: AsyraDesignAiHistoryProjection | null
  readonly aiMode: AsyraDesignAiMode
  readonly aiRuntime: AiRuntimeComposition
  dispose(): Promise<void>
}

const asAiAgentFeatureRuntime = (
  runtime: AiRuntimeComposition['runtime']
): AiAgentFeatureRuntime | undefined => {
  return runtime ?? undefined
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
  const aiStartup = options.ai
    ? {
        confirmation: null,
        history: null,
        mode: 'disabled' as const,
        runtimeOptions: options.ai
      }
    : createAsyraDesignAiStartup(options.aiMode ?? 'disabled')
  const aiRuntime = composeAiAgentRuntime(aiStartup.runtimeOptions)
  const aiFeatureRuntime = asAiAgentFeatureRuntime(aiRuntime.runtime)
  // Initialize feature-system for application-level features
  const initializedFeatures = initFeatures({
    ai: {
      enabled: aiRuntime.enabled,
      providerEnabled:
        aiRuntime.providerEnabled && aiFeatureRuntime !== undefined,
      runtime: aiFeatureRuntime
    }
  })
  const aiConversation = initializedFeatures?.ai
    ? createAsyraDesignAiConversationController({
        ...(aiStartup.confirmation
          ? {
              confirmation: aiStartup.confirmation
            }
          : {}),
        ...(aiStartup.history
          ? {
              history: aiStartup.history
            }
          : {}),
        feature: initializedFeatures.ai.api,
        getElementType: (elementId) => elementApis.getElementType(elementId)
      })
    : null

  if (import.meta.env.DEV) {
    window.__AsyraE2E__ = {
      elementApis,
      hierarchyApis,
      strokeApis
    }
  }

  let disposal: Promise<void> | null = null
  const dispose = (): Promise<void> => {
    if (!disposal) {
      disposal = (async () => {
        window.removeEventListener('pagehide', handlePageHide)
        await aiConversation?.dispose()
        await aiStartup.confirmation?.dispose()
        aiStartup.history?.dispose()
        initializedFeatures?.ai?.dispose()
        await aiRuntime.dispose()
      })()
    }
    return disposal
  }
  const handlePageHide = () => {
    void dispose()
  }
  if (aiStartup.mode === 'mock') {
    window.addEventListener('pagehide', handlePageHide, { once: true })
  }

  return Object.freeze({
    aiConfirmation: aiStartup.confirmation,
    aiConversation,
    aiHistory: aiStartup.history,
    aiMode: aiStartup.mode,
    aiRuntime,
    dispose
  })
}
