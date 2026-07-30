import type { AiActionBatch } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { createDeferred } from './deferred'
import { startAsyraDesignApp } from '../../startup'
import type { AsyraDesignServerResponseRecord } from '../server-response-inbox'

const batch: AiActionBatch = {
  actions: [],
  batchId: 'resident-batch'
}

describe('Asyra Design outer startup', () => {
  it('awaits the required file response before App initialization and render', async () => {
    const response = createDeferred<AsyraDesignServerResponseRecord | null>()
    const calls: string[] = []
    const initialization = {
      aiConfirmation: {},
      aiConversation: {},
      aiHistory: {},
      dispose: vi.fn()
    }
    const render = vi.fn(() => {
      calls.push('render')
    })
    const initializeApp = vi.fn(() => {
      calls.push('init')
      return initialization as never
    })
    const start = startAsyraDesignApp(
      {
        render
      },
      {
        getRequiredFileId: vi.fn(() => 'file-fast-16'),
        initializeApp,
        readServerResponse: vi.fn(() => {
          calls.push('read')
          return response.promise
        })
      }
    )

    await Promise.resolve()
    expect(calls).toEqual(['read'])
    expect(initializeApp).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()

    response.resolve({
      batch,
      fileId: 'file-fast-16',
      schemaVersion: 1
    })
    await expect(start).resolves.toBe(initialization)

    expect(calls).toEqual(['read', 'init', 'render'])
    expect(initializeApp).toHaveBeenCalledWith({
      serverResponse: {
        batch,
        fileId: 'file-fast-16',
        schemaVersion: 1
      }
    })
    expect(render).toHaveBeenCalledWith(initialization)
  })

  it('does not initialize or render when required file identity fails', async () => {
    const initializeApp = vi.fn()
    const readServerResponse = vi.fn()
    const render = vi.fn()

    await expect(
      startAsyraDesignApp(
        {
          render
        },
        {
          getRequiredFileId: vi.fn(() => {
            throw new Error('fileId is required')
          }),
          initializeApp,
          readServerResponse
        }
      )
    ).rejects.toThrow('fileId is required')

    expect(readServerResponse).not.toHaveBeenCalled()
    expect(initializeApp).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('does not initialize or render when the response inbox read fails', async () => {
    const initializeApp = vi.fn()
    const render = vi.fn()

    await expect(
      startAsyraDesignApp(
        {
          render
        },
        {
          getRequiredFileId: vi.fn(() => 'file-unavailable'),
          initializeApp,
          readServerResponse: vi.fn(async () => {
            throw new Error('response unavailable')
          })
        }
      )
    ).rejects.toThrow('response unavailable')

    expect(initializeApp).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })
})
