import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getFeature: vi.fn(),
  getRequiredFileId: vi.fn(() => 'crdt-7076-sample'),
  resetDemoDocument: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  getFeature: mocks.getFeature
}))

vi.mock('../../states/app', () => ({
  app: { value: null },
  setPixiApp: vi.fn()
}))

vi.mock('../../config/demo-document', () => ({
  resetDemoDocument: mocks.resetDemoDocument
}))

vi.mock('../../render-app/collaboration-mode', () => ({
  getRequiredFileId: mocks.getRequiredFileId
}))

import * as appController from '../app'

describe('App controller Reset boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates the current demo file to the save-empty-and-refresh owner', () => {
    appController.resetData()

    expect(mocks.getRequiredFileId).toHaveBeenCalledOnce()
    expect(mocks.resetDemoDocument).toHaveBeenCalledOnce()
    expect(mocks.resetDemoDocument).toHaveBeenCalledWith('crdt-7076-sample')
    expect(mocks.getFeature).not.toHaveBeenCalled()
  })
})
