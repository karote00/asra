import {
  AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE,
  AiDocumentInteractionTargets
} from '../constants'

interface DocumentInteractionEventTarget {
  addEventListener(
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean
  ): void
  removeEventListener(
    type: string,
    listener: EventListener,
    options?: EventListenerOptions | boolean
  ): void
}

export interface DocumentInteractionLock {
  acquire(): () => void
  isActive(): boolean
}

const GUARDED_EVENT_TYPES = Object.freeze([
  'auxclick',
  'beforeinput',
  'change',
  'click',
  'contextmenu',
  'dblclick',
  'dragend',
  'dragenter',
  'dragleave',
  'dragover',
  'dragstart',
  'drop',
  'input',
  'keydown',
  'keyup',
  'mousedown',
  'mousemove',
  'mouseup',
  'pointercancel',
  'pointerdown',
  'pointermove',
  'pointerup',
  'submit',
  'touchcancel',
  'touchend',
  'touchmove',
  'touchstart',
  'wheel'
] as const)

const LISTENER_OPTIONS = Object.freeze({
  capture: true,
  passive: false
})

const AGENT_CANCEL_ACTIVATION_EVENT_TYPES = new Set([
  'click',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchend',
  'touchstart'
])

const VIEWPORT_ZOOM_MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight'
])

const VIEWPORT_ZOOM_MODIFIER_KEYS = new Set(['Control', 'Meta', 'OS'])

const getInteractionTarget = (event: Event): string | null => {
  if (typeof Element === 'undefined' || !(event.target instanceof Element)) {
    return null
  }

  return (
    event.target
      .closest(`[${AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE}]`)
      ?.getAttribute(AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE) ?? null
  )
}

const isAgentCancelActivation = (event: Event): boolean => {
  if (AGENT_CANCEL_ACTIVATION_EVENT_TYPES.has(event.type)) {
    return true
  }
  if (event.type !== 'keydown' && event.type !== 'keyup') {
    return false
  }
  const code = (event as KeyboardEvent).code
  return code === 'Enter' || code === 'Space'
}

const isViewportZoomModifierChange = (event: Event): boolean => {
  if (
    (event.type !== 'keydown' && event.type !== 'keyup') ||
    !(event instanceof KeyboardEvent)
  ) {
    return false
  }

  return (
    VIEWPORT_ZOOM_MODIFIER_CODES.has(event.code) ||
    VIEWPORT_ZOOM_MODIFIER_KEYS.has(event.key)
  )
}

const isAllowedInteraction = (event: Event): boolean => {
  const interactionTarget = getInteractionTarget(event)
  return (
    isViewportZoomModifierChange(event) ||
    (isAgentCancelActivation(event) &&
      interactionTarget === AiDocumentInteractionTargets.AGENT_CANCEL) ||
    (event.type === 'wheel' &&
      interactionTarget === AiDocumentInteractionTargets.VIEWPORT_NAVIGATION)
  )
}

const getDefaultEventTarget = (): DocumentInteractionEventTarget | null =>
  typeof window === 'undefined' ? null : window

export const createDocumentInteractionLock = (
  getEventTarget: () => DocumentInteractionEventTarget | null = getDefaultEventTarget
): DocumentInteractionLock => {
  let acquisitionCount = 0
  let attachedTarget: DocumentInteractionEventTarget | null = null

  const guardInteraction: EventListener = (event) => {
    if (acquisitionCount === 0 || isAllowedInteraction(event)) {
      return
    }

    if (event.cancelable) {
      event.preventDefault()
    }
    event.stopImmediatePropagation()
  }

  const attach = (): void => {
    attachedTarget = getEventTarget()
    if (!attachedTarget) {
      return
    }
    for (const eventType of GUARDED_EVENT_TYPES) {
      attachedTarget.addEventListener(
        eventType,
        guardInteraction,
        LISTENER_OPTIONS
      )
    }
  }

  const detach = (): void => {
    if (!attachedTarget) {
      return
    }
    for (const eventType of GUARDED_EVENT_TYPES) {
      attachedTarget.removeEventListener(
        eventType,
        guardInteraction,
        LISTENER_OPTIONS
      )
    }
    attachedTarget = null
  }

  return {
    acquire: () => {
      if (acquisitionCount === 0) {
        attach()
      }
      acquisitionCount += 1
      let released = false

      return () => {
        if (released) {
          return
        }
        released = true
        acquisitionCount -= 1
        if (acquisitionCount === 0) {
          detach()
        }
      }
    },
    isActive: () => acquisitionCount > 0
  }
}

export const documentInteractionLock = createDocumentInteractionLock()
