import renderSceneTreeStore from './stores/scene-tree.js'
import renderSelectionStore from './stores/selection.js'
import interactionTargetRegistry from './registries/interaction-target.js'
import renderInteractionHandlerRegistry from './registries/render-interaction-handler.js'

/** The shared runtime's visual resources must already be retired. */
export const resetSharedRenderRuntime = (): void => {
  renderSceneTreeStore.resetRuntime()
  renderSelectionStore.resetRuntime()
  interactionTargetRegistry.clear()
  renderInteractionHandlerRegistry.clear()
}

/** Core calls this only after every old runtime owner has finished cleanup. */
export const beginSharedRenderRuntime = (): void => {
  renderSceneTreeStore.beginRuntime()
}
