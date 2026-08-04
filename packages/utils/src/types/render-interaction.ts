import type { PositionData } from './geometry.js'
import type { MouseButton } from '../constants/index.js'

export type RenderPointerTargetKind = 'element' | 'overlay'

export interface RenderPointerPositions {
  client: PositionData
  canvas: PositionData
  workspace: PositionData
}

export interface RenderPointerModifiers {
  alt: boolean
  ctrl: boolean
  shift: boolean
  meta: boolean
}

export interface RenderPointerPayload {
  targetId: string
  targetType: string
  targetKind: RenderPointerTargetKind
  elementId?: string
  meta?: Record<string, unknown>
  position?: RenderPointerPositions
  button?: MouseButton
  buttons?: number
  pointerId?: number
  pointerType?: string
  modifiers?: RenderPointerModifiers
}

export type RenderInteractionCaptureMode =
  | 'none'
  | 'pointer'
  | 'pointer-block-input'

export interface RenderPointerCapturePayload {
  targetId: string
  targetType: string
  targetKind: RenderPointerTargetKind
  captureMode: RenderInteractionCaptureMode
  blockInput: boolean
}
