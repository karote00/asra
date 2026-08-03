import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STATUS_TOAST_AUTO_DISMISS_MS,
  STATUS_TOAST_EXIT_MS,
  StatusToastStack
} from '../status-toast-stack'

const DATABASE_MESSAGE = 'Document database is unavailable.'
const COLLABORATION_MESSAGE = 'Collaboration server is unavailable.'

describe('status toast stack', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean
      }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
    ;(
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean
      }
    ).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('dismisses one toast from its top-right close button and collapses its row before removal', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <StatusToastStack
          toasts={[
            { id: 'database', message: DATABASE_MESSAGE },
            { id: 'collaboration', message: COLLABORATION_MESSAGE }
          ]}
        />
      )
    })

    const closeButton = host.querySelector<HTMLButtonElement>(
      `[aria-label="Close ${DATABASE_MESSAGE}"]`
    )
    expect(closeButton).not.toBeNull()

    await act(async () => closeButton?.click())

    const exitingToast = host.querySelector<HTMLElement>(
      '[data-toast-id="database"]'
    )
    expect(exitingToast?.dataset.state).toBe('closing')
    expect(exitingToast?.style.gridTemplateRows).toBe('0fr')
    expect(exitingToast?.style.transitionProperty).toContain(
      'grid-template-rows'
    )
    expect(host.querySelector('[data-toast-id="collaboration"]')).not.toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(STATUS_TOAST_EXIT_MS)
    })

    expect(host.querySelector('[data-toast-id="database"]')).toBeNull()
    expect(host.querySelector('[data-toast-id="collaboration"]')).not.toBeNull()

    await act(async () => root.unmount())
  })

  it('automatically dismisses a toast after ten seconds', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        <StatusToastStack
          toasts={[{ id: 'database', message: DATABASE_MESSAGE }]}
        />
      )
    })

    await act(async () => {
      vi.advanceTimersByTime(STATUS_TOAST_AUTO_DISMISS_MS - 1)
    })
    expect(host.querySelector('[data-toast-id="database"]')).not.toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(
      host
        .querySelector('[data-toast-id="database"]')
        ?.getAttribute('data-state')
    ).toBe('closing')

    await act(async () => {
      vi.advanceTimersByTime(STATUS_TOAST_EXIT_MS)
    })
    expect(host.querySelector('[data-toast-id="database"]')).toBeNull()

    await act(async () => root.unmount())
  })
})
