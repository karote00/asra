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
  createAsyraDesignAiConversationController,
  type AsyraDesignAiConversationController
} from '../ai/conversation'
import type { AsyraDesignAiConfirmationBroker } from '../ai/confirmation'
import {
  createAsyraDesignAiStartup,
  type AsyraDesignAiStartup
} from '../ai/startup'
import type { AsyraDesignServerResponseRecord } from '../ai/server-response-inbox'
import type { AsyraDesignAiHistoryProjection } from '../common-apis/history'

export interface InitAppOptions {
  serverResponse: AsyraDesignServerResponseRecord | null
}

export interface AppInitialization {
  readonly aiConfirmation: AsyraDesignAiConfirmationBroker
  readonly aiConversation: AsyraDesignAiConversationController
  readonly aiHistory: AsyraDesignAiHistoryProjection
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
 * export const initApp = (serverResponse) => {
 *   // Initialize base framework
 *   const initialization = baseInitApp({ serverResponse })
 *
 *   // Add custom initialization
 *   customInputHandlers()
 *   customBehaviors()
 *
 *   return initialization
 * }
 * ```
 */
export const initApp = (options: InitAppOptions): AppInitialization => {
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
  const aiStartup: AsyraDesignAiStartup = createAsyraDesignAiStartup({
    response: options.serverResponse
  })
  const aiRuntime = aiStartup.runtime
  // Initialize feature-system for application-level features
  let initializedFeatures: ReturnType<typeof initFeatures>
  try {
    initializedFeatures = initFeatures({
      aiRuntime
    })
  } catch (error) {
    void aiStartup.confirmation.dispose()
    aiStartup.history.dispose()
    void aiRuntime.dispose()
    throw error
  }
  const aiConversation = createAsyraDesignAiConversationController({
    confirmation: aiStartup.confirmation,
    feature: initializedFeatures.ai.api,
    getElementType: (elementId) => elementApis.getElementType(elementId),
    history: aiStartup.history
  })

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
        await aiConversation.dispose()
        await aiStartup.confirmation.dispose()
        aiStartup.history.dispose()
        initializedFeatures.ai.dispose()
        await aiRuntime.dispose()
      })()
    }
    return disposal
  }
  const handlePageHide = () => {
    void dispose()
  }
  window.addEventListener('pagehide', handlePageHide, { once: true })

  return Object.freeze({
    aiConfirmation: aiStartup.confirmation,
    aiConversation,
    aiHistory: aiStartup.history,
    dispose
  })
}
