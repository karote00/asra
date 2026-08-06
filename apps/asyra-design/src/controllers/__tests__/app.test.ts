import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getFeature: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  getFeature: mocks.getFeature
}))

vi.mock('../../states/app', () => ({
  app: { value: null },
  setPixiApp: vi.fn()
}))

import * as appController from '../app'

describe('App controller boundary', () => {
  it('does not expose a local-only document Reset adapter', () => {
    expect(appController).not.toHaveProperty('resetData')
  })
})
