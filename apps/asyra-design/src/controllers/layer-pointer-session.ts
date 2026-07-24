import { FEATURE_MOVEMENT_THRESHOLD } from '../constants'

export type LayerDropZone = 'before' | 'inside' | 'after'

export type LayerPointerTarget =
  | {
      kind: 'row'
      elementId: string
      zone: LayerDropZone
    }
  | {
      kind: 'workspace'
    }

export type LayerPointerCancellationReason =
  | 'escape'
  | 'pointer-cancel'
  | 'lost-capture'
  | 'unmount'
  | 'outside'

export interface LayerPointerSession {
  phase: 'start' | 'update' | 'end' | 'cancel'
  pointerId: number
  sourceElementId: string
  startClientX: number
  startClientY: number
  clientX: number
  clientY: number
  dragActive: boolean
  target: LayerPointerTarget | null
  cancellationReason?: LayerPointerCancellationReason
}

interface LayerPointerStartInput {
  pointerId: number
  sourceElementId: string
  clientX: number
  clientY: number
}

interface LayerPointerProgressInput {
  pointerId: number
  clientX: number
  clientY: number
  target: LayerPointerTarget | null
}

const isOpenSession = (session: LayerPointerSession): boolean =>
  session.phase === 'start' || session.phase === 'update'

const isMatchingPointer = (
  session: LayerPointerSession,
  pointerId: number
): boolean => isOpenSession(session) && session.pointerId === pointerId

const crossedMovementThreshold = (
  session: LayerPointerSession,
  input: LayerPointerProgressInput
): boolean => {
  const deltaX = input.clientX - session.startClientX
  const deltaY = input.clientY - session.startClientY
  const threshold = FEATURE_MOVEMENT_THRESHOLD.layerHierarchy
  return deltaX * deltaX + deltaY * deltaY >= threshold * threshold
}

export const createLayerPointerSession = ({
  pointerId,
  sourceElementId,
  clientX,
  clientY
}: LayerPointerStartInput): LayerPointerSession => ({
  phase: 'start',
  pointerId,
  sourceElementId,
  startClientX: clientX,
  startClientY: clientY,
  clientX,
  clientY,
  dragActive: false,
  target: null
})

export const updateLayerPointerSession = (
  session: LayerPointerSession,
  input: LayerPointerProgressInput
): LayerPointerSession | null => {
  if (!isMatchingPointer(session, input.pointerId)) {
    return null
  }

  return {
    ...session,
    phase: 'update',
    clientX: input.clientX,
    clientY: input.clientY,
    dragActive:
      session.dragActive || crossedMovementThreshold(session, input),
    target: input.target
  }
}

export const endLayerPointerSession = (
  session: LayerPointerSession,
  input: LayerPointerProgressInput
): LayerPointerSession | null => {
  if (!isMatchingPointer(session, input.pointerId)) {
    return null
  }

  return {
    ...session,
    phase: 'end',
    clientX: input.clientX,
    clientY: input.clientY,
    dragActive:
      session.dragActive || crossedMovementThreshold(session, input),
    target: input.target
  }
}

export const cancelLayerPointerSession = (
  session: LayerPointerSession,
  cancellationReason: LayerPointerCancellationReason
): LayerPointerSession | null => {
  if (!isOpenSession(session)) {
    return null
  }

  return {
    ...session,
    phase: 'cancel',
    target: null,
    cancellationReason
  }
}

export const isLayerPointerBypassTarget = (
  target: EventTarget | null
): boolean => {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return false
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [data-layer-pointer-bypass="true"]'
    )
  )
}
