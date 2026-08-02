import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resetPersistedDocument: vi.fn(async () => undefined)
}))

vi.mock('../../states/app', () => ({
  app: { value: null },
  setPixiApp: vi.fn()
}))

vi.mock('../../document-persistence', () => ({
  resetPersistedDocument: mocks.resetPersistedDocument
}))

import core from '../../contexts'
import { resetData } from '../app'

describe('App controller data reset', () => {
  beforeEach(() => {
    mocks.resetPersistedDocument.mockClear()
  })

  it('delegates one reset to the active file-scoped persistence owner', async () => {
    await resetData()

    expect(mocks.resetPersistedDocument).toHaveBeenCalledOnce()
    expect(mocks.resetPersistedDocument).toHaveBeenCalledWith(core)
  })
})
