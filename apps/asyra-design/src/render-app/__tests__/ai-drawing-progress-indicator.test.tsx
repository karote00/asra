import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PresetSystemPropertyKeys } from '@asyra/preset'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiDrawingProgressState } from '../../common-apis/system-context'
import { AsyraDesignSystemPropertyKeys } from '../../constants'
import core from '../../contexts'
import RenderApp from '../index'

const createSubject = <T,>(initialValue: T) => {
  let value = initialValue
  const subscribers = new Set<() => void>()

  return {
    getValue: () => value,
    next: (next: T) => {
      value = next
      subscribers.forEach((subscriber) => subscriber())
    },
    subscribe: (subscriber: () => void) => {
      subscribers.add(subscriber)
      return {
        unsubscribe: () => subscribers.delete(subscriber)
      }
    }
  }
}

const setReactActEnvironment = (active: boolean) => {
  ;(
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT: boolean
    }
  ).IS_REACT_ACT_ENVIRONMENT = active
}

describe('RenderApp AI drawing progress indicator', () => {
  const progress = createSubject<AiDrawingProgressState | null>(null)
  const viewportPosition = createSubject({ x: 5, y: 7 })
  const zoom = createSubject(2)

  beforeEach(() => {
    progress.next(null)
    viewportPosition.next({ x: 5, y: 7 })
    zoom.next(2)
    vi.spyOn(core, 'start').mockResolvedValue(undefined)
    vi.spyOn(core, 'load').mockImplementation(() => undefined)
    vi.spyOn(core, 'destroyRenderer').mockImplementation(() => undefined)
    vi.spyOn(core, 'getSystemPropertyObservable').mockImplementation((key) => {
      if (key === AsyraDesignSystemPropertyKeys.AI_DRAWING_PROGRESS) {
        return progress as never
      }
      if (key === PresetSystemPropertyKeys.VIEWPORT_POSITION) {
        return viewportPosition as never
      }
      if (key === PresetSystemPropertyKeys.ZOOM) {
        return zoom as never
      }
      return undefined
    })
    document.body.replaceChildren()
    setReactActEnvironment(true)
  })

  afterEach(() => {
    document.body.replaceChildren()
    setReactActEnvironment(false)
    vi.restoreAllMocks()
  })

  it('projects exact transformed bounds through a pointer-transparent compositor indicator', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<RenderApp />)
      await Promise.resolve()
    })

    expect(
      host.querySelector('[data-testid="ai-drawing-progress-indicator"]')
    ).toBeNull()

    await act(async () => {
      progress.next({
        bounds: { height: 50, width: 100, x: 10, y: 20 },
        completedElements: 0,
        phase: 'preparing',
        totalElements: 40
      })
    })

    const indicator = host.querySelector<HTMLElement>(
      '[data-testid="ai-drawing-progress-indicator"]'
    )
    expect(indicator).not.toBeNull()
    expect(indicator?.getAttribute('role')).toBe('status')
    expect(indicator?.getAttribute('aria-busy')).toBe('true')
    expect(indicator?.classList.contains('pointer-events-none')).toBe(true)
    expect(indicator?.style.height).toBe('100px')
    expect(indicator?.style.left).toBe('25px')
    expect(indicator?.style.top).toBe('47px')
    expect(indicator?.style.width).toBe('200px')
    expect(indicator?.textContent).toContain('Preparing drawing')

    const spinner = host.querySelector(
      '[data-testid="ai-drawing-progress-spinner"]'
    )
    expect(spinner?.classList.contains('animate-spin')).toBe(true)
    expect(spinner?.classList.contains('motion-reduce:animate-none')).toBe(true)

    await act(async () => {
      progress.next({
        bounds: { height: 50, width: 100, x: 10, y: 20 },
        completedElements: 16,
        phase: 'drawing',
        totalElements: 40
      })
    })
    expect(indicator?.textContent).toContain('Drawing 16 of 40')

    await act(async () => {
      viewportPosition.next({ x: 15, y: 17 })
      zoom.next(1)
    })
    expect(indicator?.style.height).toBe('50px')
    expect(indicator?.style.left).toBe('25px')
    expect(indicator?.style.top).toBe('37px')
    expect(indicator?.style.width).toBe('100px')

    await act(async () => {
      progress.next(null)
    })
    expect(
      host.querySelector('[data-testid="ai-drawing-progress-indicator"]')
    ).toBeNull()

    await act(async () => root.unmount())
  })
})
