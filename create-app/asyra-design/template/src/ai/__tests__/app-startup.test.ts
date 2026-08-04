import { describe, expect, it, vi } from 'vitest'
import { startApp } from '../../startup'

describe('outer startup', () => {
  it('validates fileId as document identity without preloading an Agent payload', async () => {
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

    await expect(
      startApp(
        { render },
        {
          getRequiredFileId: vi.fn(() => {
            calls.push('fileId')
            return 'crdt-7076-sample'
          }),
          initializeApp
        }
      )
    ).resolves.toBe(initialization)

    expect(calls).toEqual(['fileId', 'init', 'render'])
    expect(initializeApp).toHaveBeenCalledWith()
    expect(render).toHaveBeenCalledWith(initialization)
  })

  it('does not initialize or render when required file identity fails', async () => {
    const initializeApp = vi.fn()
    const render = vi.fn()

    await expect(
      startApp(
        { render },
        {
          getRequiredFileId: vi.fn(() => {
            throw new Error('fileId is required')
          }),
          initializeApp
        }
      )
    ).rejects.toThrow('fileId is required')

    expect(initializeApp).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })
})
