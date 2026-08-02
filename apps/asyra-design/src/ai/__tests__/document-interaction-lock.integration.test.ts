import { PresetSystemPropertyKeys } from '@asyra/preset'
import inputSystem from '@asyra/input-system'
import { InputType, PointerKey } from '@asyra/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  core: {
    getSystemProperty: vi.fn(),
    setSystemProperty: vi.fn()
  }
}))

vi.mock('../../contexts', () => ({
  default: mocks.core
}))

import {
  AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE,
  AiDocumentInteractionTargets
} from '../../constants'
import { panFeature } from '../../features/pan'
import { zoomFeature } from '../../features/zoom'
import { documentInteractionLock } from '../document-interaction-lock'
import { createAiTransactionRunner } from '../transaction'

const TEST_WHEEL_INPUT = 'test.ai-document-interaction-lock.wheel'

describe('Asyra Design AI document interaction integration', () => {
  beforeEach(() => {
    mocks.core.getSystemProperty.mockImplementation((key: string) => {
      if (key === PresetSystemPropertyKeys.ZOOM) {
        return 2
      }
      if (key === PresetSystemPropertyKeys.VIEWPORT_POSITION) {
        return { x: 10, y: 20 }
      }
      return undefined
    })
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.clearAllMocks()
  })

  it('keeps App pan and zoom writes live across cooperative checkpoints while document mutations stay blocked', async () => {
    const viewport = document.createElement('div')
    viewport.setAttribute(
      AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE,
      AiDocumentInteractionTargets.VIEWPORT_NAVIGATION
    )
    const canvas = document.createElement('canvas')
    viewport.append(canvas)
    const documentControl = document.createElement('button')
    document.body.append(viewport, documentControl)

    const attemptedDocumentMutation = vi.fn()
    documentControl.addEventListener('click', attemptedDocumentMutation)
    documentControl.addEventListener('input', attemptedDocumentMutation)
    documentControl.addEventListener('keydown', attemptedDocumentMutation)
    canvas.addEventListener('wheel', (event) => {
      if (event.metaKey || event.ctrlKey) {
        zoomFeature.api.zoom(event.deltaY, event.clientX, event.clientY)
        return
      }
      panFeature.api.pan(-event.deltaX, -event.deltaY)
    })

    const runner = createAiTransactionRunner({
      runTransaction: async (execute) => execute()
    })

    expect(documentInteractionLock.isActive()).toBe(false)
    await runner.run('AI-assisted action', async () => {
      expect(documentInteractionLock.isActive()).toBe(true)
      await Promise.resolve()

      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 80,
          deltaX: 5,
          deltaY: 7
        })
      )
      documentControl.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      documentControl.dispatchEvent(
        new Event('input', { bubbles: true, cancelable: true })
      )

      await Promise.resolve()
      expect(documentInteractionLock.isActive()).toBe(true)
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 80,
          ctrlKey: true,
          deltaY: -10
        })
      )
      documentControl.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'Delete'
        })
      )
    })

    expect(documentInteractionLock.isActive()).toBe(false)
    expect(attemptedDocumentMutation).not.toHaveBeenCalled()
    expect(mocks.core.setSystemProperty).toHaveBeenCalledWith(
      PresetSystemPropertyKeys.VIEWPORT_POSITION,
      { x: 5, y: 13 }
    )
    expect(mocks.core.setSystemProperty).toHaveBeenCalledWith(
      PresetSystemPropertyKeys.ZOOM,
      expect.any(Number)
    )
    expect(mocks.core.setSystemProperty).toHaveBeenCalledTimes(3)
  })

  it('lets the real InputSystem observe Command and Control changes required by viewport zoom', () => {
    const viewport = document.createElement('div')
    viewport.setAttribute(
      AI_DOCUMENT_INTERACTION_TARGET_ATTRIBUTE,
      AiDocumentInteractionTargets.VIEWPORT_NAVIGATION
    )
    const canvas = document.createElement('canvas')
    viewport.append(canvas)
    document.body.append(viewport)

    const receivedWheel = vi.fn()
    inputSystem.registry.register(TEST_WHEEL_INPUT, [
      {
        type: InputType.WHEEL,
        keys: [PointerKey.WHEEL]
      }
    ])
    inputSystem.on(TEST_WHEEL_INPUT, receivedWheel)
    const release = documentInteractionLock.acquire()

    const dispatchWheel = () =>
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 80,
          deltaY: -10
        })
      )

    try {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'MetaLeft',
          key: 'Meta'
        })
      )
      dispatchWheel()
      expect(receivedWheel).toHaveBeenLastCalledWith(
        expect.objectContaining({
          modifiers: expect.objectContaining({ meta: true })
        })
      )

      document.body.dispatchEvent(
        new KeyboardEvent('keyup', {
          bubbles: true,
          cancelable: true,
          code: 'MetaLeft',
          key: 'Meta'
        })
      )
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          code: 'ControlLeft',
          key: 'Control'
        })
      )
      dispatchWheel()
      expect(receivedWheel).toHaveBeenLastCalledWith(
        expect.objectContaining({
          modifiers: expect.objectContaining({
            ctrl: true,
            meta: false
          })
        })
      )

      document.body.dispatchEvent(
        new KeyboardEvent('keyup', {
          bubbles: true,
          cancelable: true,
          code: 'ControlLeft',
          key: 'Control'
        })
      )
      dispatchWheel()
      expect(receivedWheel).toHaveBeenLastCalledWith(
        expect.objectContaining({
          modifiers: expect.objectContaining({
            ctrl: false,
            meta: false
          })
        })
      )
    } finally {
      release()
      inputSystem.off(TEST_WHEEL_INPUT, receivedWheel)
      inputSystem.registry.unregister(TEST_WHEEL_INPUT)
    }
  })
})
