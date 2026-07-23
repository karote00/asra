/**
 * Feature APIs that can be reused across multiple features
 *
 * This folder contains common APIs extracted from features for reuse.
 * As the framework evolves, some of these may move to core packages if needed.
 *
 * Features should ONLY import from this folder, NOT directly from contexts
 * or external packages (except through these common APIs).
 */

export { transactionApis } from './transaction'
export { selectionApis } from './selection'
export {
  elementApis,
  vectorGeometry,
  type AppendVectorAnchorPointOptions,
  type VectorPointUpdate
} from './element'
export { fillApis, type FillPatch } from './fills'
export { strokeApis, type StrokePatch } from './strokes'
export { viewportApis } from './viewport'
export { systemContextApis } from './system-context'
export { historyApis } from './history'
export { renderLayerApis } from './render-layer'
export { cursorApis } from './cursor'
