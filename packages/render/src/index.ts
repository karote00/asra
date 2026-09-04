import render, { Render } from './render.js'
import RenderAdapter, { PixiJSRenderer } from './renderer.js'
import renderSceneTreeStore from './stores/scene-tree.js'
import renderSelectionStore from './stores/selection.js'

export { IRenderer, RenderOptions, RenderResult } from './types/renderer.js'
export {
  InvalidRenderEngineProviderResultError,
  MissingRenderEngineProviderError,
  RenderErrorCodes,
  type RenderErrorCode
} from './errors.js'
export { RenderAdapter, PixiJSRenderer }
export { renderStrategyRegistry } from './registries/render-strategy.js'
export { interactionTargetRegistry } from './registries/interaction-target.js'
export { renderInteractionHandlerRegistry } from './registries/render-interaction-handler.js'
export {
  createRenderGradientFillStyle,
  type CreateRenderGradientFillOptions,
  type RenderGradientColorStop,
  type RenderGradientPoint,
  type RenderFillStyle
} from './fills/gradient-fill.js'
export {
  createEvenOddFillStyle,
  isPointInsidePreparedEvenOddShape,
  prepareEvenOddShape
} from './fills/even-odd-fill.js'
export {
  createMeshProjection,
  type GeometryPoint,
  type GeometryModel,
  type MeshProjectionPaint,
  type CreateMeshProjectionOptions,
  type MeshProjection
} from './projections/mesh-projection.js'
export type {
  EvenOddSegment,
  EvenOddPath,
  EvenOddShape,
  PreparedEvenOddSegment,
  PreparedEvenOddShape,
  EvenOddFillOptions,
  EvenOddFillResult
} from './fills/even-odd-fill.js'
export type {
  EngineNeutralRenderStrategy,
  RenderStrategy,
  RenderStrategyCapabilities,
  RenderStrategyGraphic
} from './types/render-strategy.js'
export type { RenderLayerRegistration } from './types/render-layer.js'
export type {
  RenderApplication,
  RenderEngineProviderCleanup,
  RenderEngineProviderOptions
} from './render.js'
export {
  RenderContainer,
  RenderGraphics,
  RenderMesh
} from './types/render-object.js'
export {
  defaultStrategy,
  defaultRectangleStrategy
} from './strategies/default-strategy.js'
export {
  createOverlayLayerRegistration,
  sampleOverlayBezierPoints,
  type OverlayCanvas,
  type OverlayStrokeStyle,
  type CreateOverlayLayerOptions
} from './layers/overlay-layer.js'
export {
  createRenderInteractionPointTarget,
  createRenderInteractionCircleTarget,
  createRenderInteractionSegmentTarget,
  createRenderInteractionPolylineTarget
} from './interaction/target-helpers.js'
export type {
  RenderInteractionTarget,
  RenderInteractionTargetBounds,
  RenderInteractionTargetSpace,
  RenderInteractionHandlerRegistration,
  RenderInteractionEventType,
  RenderInteractionEvent
} from './types/render-interaction.js'
export { renderSceneTreeStore, renderSelectionStore }
export {
  resetSharedRenderRuntime,
  beginSharedRenderRuntime
} from './runtime-lifecycle.js'

export default render
export { Render }
