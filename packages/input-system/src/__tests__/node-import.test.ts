// @vitest-environment node

import { describe, expect, it } from 'vitest'

describe('@asyra/input-system Node import', () => {
  it('imports and constructs without browser globals', async () => {
    expect(globalThis).not.toHaveProperty('window')
    expect(globalThis).not.toHaveProperty('document')

    const inputModule = await import('../index.js')
    const instance = new inputModule.InputSystem()

    expect(instance).toBeInstanceOf(inputModule.InputSystem)
  })
})
