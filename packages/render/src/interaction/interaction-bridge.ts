import type {
  RenderPointerPayload,
  RenderPointerPositions,
  RenderPointerCapturePayload,
  MouseButton
} from '@asyra/utils'
import { MouseButton as MouseButtonEnum } from '@asyra/utils'
import {
  renderPointerDown,
  renderPointerMove,
  renderPointerUp,
  renderPointerHover,
  renderPointerLeave,
  renderPointerCaptureStart,
  renderPointerCaptureEnd
} from '@asyra/reactive-events'
import interactionTargetRegistry from '../registries/interaction-target.js'
import renderInteractionHandlerRegistry from '../registries/render-interaction-handler.js'
import type {
  RenderInteractionEventType,
  RenderInteractionTarget
} from '../types/render-interaction.js'

type PositionResolver = (event: PointerEvent) => RenderPointerPositions | null

const resolveMouseButton = (button: number): MouseButton => {
  switch (button) {
    case 0:
      return MouseButtonEnum.LEFT
    case 1:
      return MouseButtonEnum.MIDDLE
    case 2:
      return MouseButtonEnum.RIGHT
    default:
      return MouseButtonEnum.NONE
  }
}

export class RenderInteractionBridge {
  private readonly resolvePositions: PositionResolver
  private canvas: HTMLCanvasElement | null = null
  private hoveredTarget: RenderInteractionTarget | null = null
  private capturedTarget: RenderInteractionTarget | null = null
  private capturedPointerId: number | null = null

  constructor(resolvePositions: PositionResolver) {
    this.resolvePositions = resolvePositions
  }

  attach(canvas: HTMLCanvasElement) {
    if (this.canvas) {
      this.detach()
    }

    this.canvas = canvas
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave)
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel)
  }

  detach() {
    if (!this.canvas) {
      return
    }

    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel)

    this.canvas = null
    this.hoveredTarget = null
    this.capturedTarget = null
    this.capturedPointerId = null
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (
      this.capturedTarget &&
      this.capturedPointerId !== null &&
      event.pointerId !== this.capturedPointerId
    ) {
      return
    }

    const positions = this.resolvePositions(event)
    if (!positions) {
      return
    }

    const target = this.resolveTarget(positions)
    this.updateHover(target, positions, event)
    if (!target) {
      return
    }

    this.dispatchPointerEvent('pointerdown', target, positions, event)
    this.startCaptureIfNeeded(target, event)
  }

  private handlePointerMove = (event: PointerEvent) => {
    const positions = this.resolvePositions(event)
    if (!positions) {
      return
    }

    if (
      this.capturedTarget &&
      this.capturedPointerId !== null &&
      event.pointerId !== this.capturedPointerId
    ) {
      return
    }

    const target = this.capturedTarget ?? this.resolveTarget(positions)
    this.updateHover(target, positions, event)

    if (target) {
      this.dispatchPointerEvent('pointermove', target, positions, event)
    }
  }

  private handlePointerUp = (event: PointerEvent) => {
    const positions = this.resolvePositions(event)
    if (!positions) {
      return
    }

    if (
      this.capturedTarget &&
      this.capturedPointerId !== null &&
      event.pointerId !== this.capturedPointerId
    ) {
      return
    }

    const target = this.capturedTarget ?? this.resolveTarget(positions)
    if (target) {
      this.dispatchPointerEvent('pointerup', target, positions, event)
    }

    this.endCaptureIfNeeded()
  }

  private handlePointerLeave = (event: PointerEvent) => {
    if (this.capturedTarget) {
      return
    }

    const positions = this.resolvePositions(event)
    if (!positions) {
      return
    }

    this.updateHover(null, positions, event)
  }

  private handlePointerCancel = (event: PointerEvent) => {
    if (
      this.capturedTarget &&
      this.capturedPointerId !== null &&
      event.pointerId !== this.capturedPointerId
    ) {
      return
    }

    this.endCaptureIfNeeded()
    this.hoveredTarget = null
  }

  private resolveTarget(positions: RenderPointerPositions) {
    return interactionTargetRegistry.hitTest({
      canvas: positions.canvas,
      workspace: positions.workspace
    })
  }

  private buildPayload(
    target: RenderInteractionTarget,
    positions: RenderPointerPositions,
    event: PointerEvent
  ): RenderPointerPayload {
    return {
      targetId: target.id,
      targetType: target.type,
      targetKind: 'overlay',
      meta: target.meta,
      position: positions,
      button: resolveMouseButton(event.button),
      buttons: event.buttons,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      modifiers: {
        alt: event.altKey,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        meta: event.metaKey
      }
    }
  }

  private dispatchPointerEvent(
    eventType: RenderInteractionEventType,
    target: RenderInteractionTarget,
    positions: RenderPointerPositions,
    event: PointerEvent
  ) {
    const payload = this.buildPayload(target, positions, event)

    switch (eventType) {
      case 'pointerdown':
        renderPointerDown(payload)
        break
      case 'pointermove':
        renderPointerMove(payload)
        break
      case 'pointerup':
        renderPointerUp(payload)
        break
      case 'pointerenter':
        renderPointerHover(payload)
        break
      case 'pointerleave':
        renderPointerLeave(payload)
        break
    }

    this.dispatchHandlers(eventType, payload, target)
  }

  private dispatchHandlers(
    eventType: RenderInteractionEventType,
    payload: RenderPointerPayload,
    target: RenderInteractionTarget
  ) {
    const registrations = renderInteractionHandlerRegistry.get(
      target.id,
      eventType
    )
    registrations.forEach((registration) => {
      registration.handler({ type: eventType, payload })
    })
  }

  private updateHover(
    target: RenderInteractionTarget | null,
    positions: RenderPointerPositions,
    event: PointerEvent
  ) {
    const nextId = target?.id ?? null
    const currentId = this.hoveredTarget?.id ?? null

    if (nextId === currentId) {
      return
    }

    if (this.hoveredTarget) {
      this.dispatchPointerEvent(
        'pointerleave',
        this.hoveredTarget,
        positions,
        event
      )
    }

    if (target) {
      this.dispatchPointerEvent('pointerenter', target, positions, event)
    }

    this.hoveredTarget = target
  }

  private startCaptureIfNeeded(
    target: RenderInteractionTarget,
    event: PointerEvent
  ) {
    const captureMode = target.capture ?? 'none'
    if (captureMode === 'none') {
      return
    }

    this.capturedTarget = target
    this.capturedPointerId = event.pointerId

    if (this.canvas && this.canvas.setPointerCapture) {
      try {
        this.canvas.setPointerCapture(event.pointerId)
      } catch (error) {
        // Ignore DOM capture errors (unsupported or invalid pointer id)
      }
    }

    const payload: RenderPointerCapturePayload = {
      targetId: target.id,
      targetType: target.type,
      targetKind: 'overlay',
      captureMode,
      blockInput: captureMode === 'pointer-block-input'
    }

    renderPointerCaptureStart(payload)
  }

  private endCaptureIfNeeded() {
    if (!this.capturedTarget) {
      return
    }

    const target = this.capturedTarget
    const captureMode = target.capture ?? 'none'

    if (this.canvas && this.canvas.releasePointerCapture) {
      try {
        if (this.capturedPointerId !== null) {
          this.canvas.releasePointerCapture(this.capturedPointerId)
        }
      } catch (error) {
        // Ignore DOM capture errors
      }
    }

    const payload: RenderPointerCapturePayload = {
      targetId: target.id,
      targetType: target.type,
      targetKind: 'overlay',
      captureMode,
      blockInput: captureMode === 'pointer-block-input'
    }

    renderPointerCaptureEnd(payload)

    this.capturedTarget = null
    this.capturedPointerId = null
  }
}

export default RenderInteractionBridge
