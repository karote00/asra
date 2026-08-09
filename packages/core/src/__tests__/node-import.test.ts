// @vitest-environment node

import { describe, expect, it } from 'vitest'

describe('@asyra/core Node import', () => {
  it('imports the default public entry without browser globals', async () => {
    expect(globalThis).not.toHaveProperty('window')
    expect(globalThis).not.toHaveProperty('document')

    const coreModule = await import('../index.js')

    expect(coreModule.default).toBeDefined()
    expect(coreModule.Core).toBeTypeOf('function')
  })
})
