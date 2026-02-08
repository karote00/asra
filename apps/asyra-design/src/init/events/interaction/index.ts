/**
 * App-level interaction decision events
 * Uses eventRegistry to create publish/subscribe functions for all interaction decisions
 */

import { eventRegistry } from '@asyra/reactive-events'
import type { PositionData, EVENT_OPTIONS, UNDO, PanZoom } from '@asyra/utils'
import type { MouseSnapshot } from '@asyra/utils'
import type { PrimaryToolType } from '../../../constants'

// Transaction events
const startTransactionEvent = eventRegistry.register('decideToStartTransaction')
export const decideToStartTransaction = startTransactionEvent.publish
export const startTransaction = startTransactionEvent.publish
export const subscribeToDecideToStartTransaction =
  startTransactionEvent.subscribe

const endTransactionEvent = eventRegistry.register('decideToEndTransaction')
export const decideToEndTransaction = endTransactionEvent.publish
export const endTransaction = endTransactionEvent.publish
export const subscribeToDecideToEndTransaction = endTransactionEvent.subscribe

// Element events
const selectElementsEvent = eventRegistry.register('decideToSelectElements')
export const selectElements = (elementIds: string[]) => {
  selectElementsEvent.publish({ elementIds })
}
export const decideToSelectElements = (elementIds: string[]) => {
  selectElementsEvent.publish({ elementIds })
}
export const subscribeToDecideToSelectElements = selectElementsEvent.subscribe

// Undo/Redo events
const undoRedoEvent = eventRegistry.register('decideToUndoRedo')

export const decideToUndoRedo = (undoredo: UNDO) => {
  undoRedoEvent.publish({ undoredo })
}

export const subscribeToDecideToUndoRedo = undoRedoEvent.subscribe

// Viewport events
const zoomFitEvent = eventRegistry.register('decideToZoomFit')
export const decideToZoomFit = zoomFitEvent.publish
export const subscribeToDecideToZoomFit = zoomFitEvent.subscribe

const panZoomEvent = eventRegistry.register('decideToPanZoom')

export const decideToPanZoom = (
  panzoom: PanZoom,
  mouse: MouseSnapshot['position'],
  wheel: MouseSnapshot['delta']
) => {
  panZoomEvent.publish({ panzoom, mouse, wheel })
}

export const subscribeToDecideToPanZoom = panZoomEvent.subscribe

// Export types for documentation
export interface InteractionEventPayloads {
  decideToCreateElement: {
    position: PositionData
    elementType: PrimaryToolType
  }
  decideToSelectElements: {
    elementIds: string[]
  }
  decideToResizeElement: {
    dragStart: PositionData
    position: PositionData
    elementType: PrimaryToolType
  }
  decideToEndResizeElement: {
    position: PositionData
    elementType: PrimaryToolType
  }
  decideToResetElementSize: {
    dimension: { width: number; height: number }
    elementType: PrimaryToolType
  }
  decideToUndoRedo: {
    undoredo: UNDO
  }
  decideToZoomFit: {}
  decideToPanZoom: {
    panzoom: PanZoom
    mouse: MouseSnapshot['position']
    wheel: MouseSnapshot['delta']
  }
}
