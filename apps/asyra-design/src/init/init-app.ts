import { applyPreset } from '@asyra/preset'
import core from '../contexts'
import { initAreaSelection } from './capabilities/init-area-selection'
import { initAiDrawingProgress } from './capabilities/init-ai-drawing-progress'
import { initGradientFillEditing } from './capabilities/init-gradient-fill-editing'
import { initVectorIconData } from './capabilities/init-vector-icon-data'
import { initLoadDiagnostics } from './diagnostics/init-load-diagnostics'
import { initCanvasPipelineDebugger } from './diagnostics/init-canvas-pipeline-debugger'
import { initSelectionCompatibility } from './derived-state/init-selection-compatibility'
import { initPathEditingContinuation } from './derived-state/init-path-editing-continuation'
import { initFeatures } from './foundation/init-features'
import { initInputSystem } from './foundation/init-input-system'
import { elementApis } from '../common-apis/element'
import { viewportApis } from '../common-apis/viewport'
import {
  createAiConversationController,
  type AiConversationController
} from '../ai/conversation'
import type { AiConfirmationBroker } from '../ai/confirmation'
import { createAiStartup, type AiStartup } from '../ai/startup'
import type { AiHistoryProjection } from '../common-apis/history'
import {
  attachAiDrawingPerformanceRuntimeEvidence,
  getActiveAiDrawingPerformanceProfile
} from './performance/ai-drawing-performance-profile'

export interface AppInitialization {
  readonly aiConfirmation: AiConfirmationBroker
  readonly aiConversation: AiConversationController
  readonly aiHistory: AiHistoryProjection
  dispose(): Promise<void>
}

/**
 * Initializes all framework components and configurations.
 *
 * This is the single entry point for setting up the Design App framework in your app.
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
export const initApp = (): AppInitialization => {
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
  initAiDrawingProgress()
  initGradientFillEditing()
  initVectorIconData()

  // Foundation init.
  initInputSystem()
  const aiStartup: AiStartup = createAiStartup()
  let initializedFeatures: ReturnType<typeof initFeatures>
  try {
    initializedFeatures = initFeatures({
      aiRuntime: aiStartup.runtime
    })
  } catch (error) {
    aiStartup.history.dispose()
    void Promise.allSettled([
      aiStartup.confirmation.dispose(),
      aiStartup.runtime.dispose()
    ])
    throw error
  }
  const aiFeature = initializedFeatures.ai
  const aiConversation = createAiConversationController({
    confirmation: aiStartup.confirmation,
    history: aiStartup.history,
    feature: aiFeature.api,
    getElementType: (elementId) => elementApis.getElementType(elementId)
  })

  const performanceProfile = getActiveAiDrawingPerformanceProfile()
  const detachPerformanceRuntimeEvidence = performanceProfile
    ? attachAiDrawingPerformanceRuntimeEvidence(performanceProfile, {
        readCanonicalElementCount: () =>
          Math.max(
            0,
            core.deps.sceneTree.getAllElements().size -
              core.deps.sceneTree.workspaceList.length
          ),
        readCanonicalElements: () =>
          Array.from(core.deps.sceneTree.getAllElements().entries()).map(
            ([id, element]) => ({
              computed: element.getAllComputedData(),
              id,
              raw: element.save(),
              rendered: Boolean(core.deps.render.getElementById(id)),
              type: String(element.get('type'))
            })
          ),
        readCanonicalOwnerSnapshot: () => ({
          props: core.deps.props.save(),
          sceneTree: core.deps.sceneTree.save()
        }),
        readHistoryDepth: () => core.deps.factory.getUndoHistoryDepth(),
        readRenderProjectionElementCount: () =>
          core.deps.render.getProjectedElementCount(),
        readViewportPosition: () => viewportApis.getPosition(),
        readZoom: () => viewportApis.getScale(),
        subscribeToTransactionStatus: (subscriber) =>
          core.deps.factory.subscribeToTransactionStatus(subscriber)
      })
    : undefined

  let disposal: Promise<void> | null = null
  const dispose = (): Promise<void> => {
    if (!disposal) {
      disposal = (async () => {
        window.removeEventListener('pagehide', handlePageHide)
        detachPerformanceRuntimeEvidence?.()
        await aiConversation.dispose()
        await aiStartup.confirmation.dispose()
        aiStartup.history.dispose()
        aiFeature.dispose()
        await aiStartup.runtime.dispose()
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
