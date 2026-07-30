import { indexedDB as testIndexedDb } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRequiredFileId: vi.fn(() => 'file-1')
}))

vi.mock('../../states/app', () => ({
  app: { value: null },
  setPixiApp: vi.fn()
}))

vi.mock('../../render-app/collaboration-mode', () => ({
  getRequiredFileId: mocks.getRequiredFileId
}))

import core from '../../contexts'
import { resetData } from '../app'

const EMPTY_DOCUMENT = {
  version: '1.0.0',
  sceneTree: { workspace: '', workspaceList: [], elements: {} },
  props: {}
} as const

describe('App controller data reset', () => {
  const reload = vi.fn()

  beforeEach(() => {
    reload.mockClear()
    mocks.getRequiredFileId.mockClear()
    window.history.replaceState({}, '', '/?fileId=file-1')
    vi.stubGlobal('indexedDB', testIndexedDb)
    vi.stubGlobal('location', { reload })
    vi.spyOn(core, 'load').mockImplementation(() => undefined)
    vi.spyOn(testIndexedDb, 'open')
    vi.spyOn(Storage.prototype, 'getItem')
    vi.spyOn(Storage.prototype, 'setItem')
    vi.spyOn(Storage.prototype, 'removeItem')
    vi.spyOn(Storage.prototype, 'clear')
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads one fresh empty document without storage, URL, reload, or shared-action work', async () => {
    resetData()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(testIndexedDb.open).not.toHaveBeenCalled()
    expect(Storage.prototype.getItem).not.toHaveBeenCalled()
    expect(Storage.prototype.setItem).not.toHaveBeenCalled()
    expect(Storage.prototype.removeItem).not.toHaveBeenCalled()
    expect(Storage.prototype.clear).not.toHaveBeenCalled()
    expect(mocks.getRequiredFileId).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    expect(core.load).toHaveBeenCalledOnce()
    expect(core.load).toHaveBeenCalledWith(EMPTY_DOCUMENT)
  })

  it('creates an independent empty document for every reset', async () => {
    resetData()
    resetData()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(core.load).toHaveBeenCalledTimes(2)
    const firstDocument = vi.mocked(core.load).mock.calls[0]?.[0]
    const secondDocument = vi.mocked(core.load).mock.calls[1]?.[0]
    expect(firstDocument).toEqual(EMPTY_DOCUMENT)
    expect(secondDocument).toEqual(EMPTY_DOCUMENT)
    expect(firstDocument).not.toBe(secondDocument)
    expect(firstDocument?.sceneTree).not.toBe(secondDocument?.sceneTree)
    expect(firstDocument?.props).not.toBe(secondDocument?.props)
  })
})
