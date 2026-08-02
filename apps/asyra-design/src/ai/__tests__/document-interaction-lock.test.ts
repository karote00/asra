import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE,
  AiDocumentInteractionTargets
} from '../../constants'
import { createDocumentInteractionLock } from '../document-interaction-lock'

const markTarget = (
  element: HTMLElement,
  target: (typeof AiDocumentInteractionTargets)[keyof typeof AiDocumentInteractionTargets]
): HTMLElement => {
  element.setAttribute(AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE, target)
  return element
}

describe('Asyra Design AI document interaction lock', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('allows viewport wheel navigation and Agent cancellation while blocking other DOM interaction', () => {
    const viewport = markTarget(
      document.createElement('div'),
      AiDocumentInteractionTargets.VIEWPORT_NAVIGATION
    )
    const canvas = document.createElement('canvas')
    viewport.append(canvas)
    const cancel = markTarget(
      document.createElement('button'),
      AiDocumentInteractionTargets.AGENT_CANCEL
    )
    const edit = document.createElement('button')
    document.body.append(viewport, cancel, edit)

    const navigationReceived = vi.fn()
    const cancelReceived = vi.fn()
    const cancelActivationReceived = vi.fn()
    const cancelShortcutReceived = vi.fn()
    const cancelWheelReceived = vi.fn()
    const editReceived = vi.fn()
    const shortcutReceived = vi.fn()
    canvas.addEventListener('wheel', navigationReceived)
    cancel.addEventListener('click', cancelReceived)
    cancel.addEventListener('keydown', (event) => {
      if (event.code === 'Enter') {
        cancelActivationReceived(event)
        return
      }
      cancelShortcutReceived(event)
    })
    cancel.addEventListener('pointerdown', cancelActivationReceived)
    cancel.addEventListener('touchstart', cancelActivationReceived)
    cancel.addEventListener('wheel', cancelWheelReceived)
    edit.addEventListener('click', editReceived)
    edit.addEventListener('keydown', shortcutReceived)

    const lock = createDocumentInteractionLock()
    const release = lock.acquire()

    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 20
    })
    const cancelClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    })
    const editClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    })
    const editShortcut = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'Delete'
    })
    const cancelShortcut = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'Delete'
    })
    const cancelKeyboardActivation = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'Enter',
      key: 'Enter'
    })
    const cancelPointerActivation = new Event('pointerdown', {
      bubbles: true,
      cancelable: true
    })
    const cancelTouchActivation = new Event('touchstart', {
      bubbles: true,
      cancelable: true
    })
    const cancelWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 20
    })

    try {
      canvas.dispatchEvent(wheel)
      cancel.dispatchEvent(cancelClick)
      cancel.dispatchEvent(cancelKeyboardActivation)
      cancel.dispatchEvent(cancelPointerActivation)
      cancel.dispatchEvent(cancelTouchActivation)
      cancel.dispatchEvent(cancelShortcut)
      cancel.dispatchEvent(cancelWheel)
      edit.dispatchEvent(editClick)
      edit.dispatchEvent(editShortcut)
      expect(navigationReceived).toHaveBeenCalledOnce()
      expect(cancelReceived).toHaveBeenCalledOnce()
      expect(cancelActivationReceived).toHaveBeenCalledTimes(3)
      expect(cancelShortcut.defaultPrevented).toBe(true)
      expect(cancelWheel.defaultPrevented).toBe(true)
      expect(editClick.defaultPrevented).toBe(true)
      expect(editShortcut.defaultPrevented).toBe(true)
      expect(cancelShortcutReceived).not.toHaveBeenCalled()
      expect(cancelWheelReceived).not.toHaveBeenCalled()
      expect(editReceived).not.toHaveBeenCalled()
      expect(shortcutReceived).not.toHaveBeenCalled()
      expect(lock.isActive()).toBe(true)

      release()

      const unlockedClick = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      })
      edit.dispatchEvent(unlockedClick)
      expect(editReceived).toHaveBeenCalledOnce()
      expect(lock.isActive()).toBe(false)
    } finally {
      release()
    }
  })

  it('keeps nested acquisition active until the final idempotent release', () => {
    const edit = document.createElement('button')
    document.body.append(edit)
    const received = vi.fn()
    edit.addEventListener('click', received)
    const lock = createDocumentInteractionLock()
    const releaseOuter = lock.acquire()
    const releaseInner = lock.acquire()

    try {
      releaseOuter()
      releaseOuter()
      expect(lock.isActive()).toBe(true)
      const lockedClick = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      })
      edit.dispatchEvent(lockedClick)
      expect(lockedClick.defaultPrevented).toBe(true)
      expect(received).not.toHaveBeenCalled()

      releaseInner()
      expect(lock.isActive()).toBe(false)
      edit.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      expect(received).toHaveBeenCalledOnce()
    } finally {
      releaseOuter()
      releaseInner()
    }
  })
})
