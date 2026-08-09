import { describe, expect, it, vi } from 'vitest'
import { createInputSystemAPIs } from '../apis/input-system.js'

describe('Core Input System facade', () => {
  it('activates the exact InputSystem composed into Core', () => {
    const inputSystem = {
      switchWatchedElement: vi.fn()
    }
    const canvas = document.createElement('canvas')
    const apis = createInputSystemAPIs(inputSystem as never)

    apis.setupInputSystem(canvas)

    expect(inputSystem.switchWatchedElement).toHaveBeenCalledOnce()
    expect(inputSystem.switchWatchedElement).toHaveBeenCalledWith(canvas)
  })
})
