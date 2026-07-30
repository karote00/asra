import { indexedDB as testIndexedDb } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import core from '../../contexts'
import { resetData } from '../app'

const mocks = vi.hoisted(() => ({
  coreLoad: vi.fn(),
  getRequiredFileId: vi.fn(() => 'file-1')
}))

vi.mock('@asyra/core', () => ({
  getFeature: vi.fn()
}))

vi.mock('../../contexts', () => ({
  default: {
    load: mocks.coreLoad
  }
}))

vi.mock('../../constants', () => ({
  FeatureNames: {
    SWITCH_PRIMARY_TOOL: 'switch-primary-tool'
  }
}))

vi.mock('../../states/app', () => ({
  app: { value: null },
  setPixiApp: vi.fn()
}))

vi.mock('../../render-app/collaboration-mode', () => ({
  getRequiredFileId: mocks.getRequiredFileId
}))

const EMPTY_DOCUMENT = {
  version: '1.0.0',
  sceneTree: { workspace: '', workspaceList: [], elements: {} },
  props: {}
} as const

describe('App controller', () => {
  const reload = vi.fn()

  beforeEach(() => {
    reload.mockClear()
    mocks.coreLoad.mockReset()
    mocks.getRequiredFileId.mockClear()
    window.history.replaceState({}, '', '/?fileId=file-1')
    vi.stubGlobal('indexedDB', testIndexedDb)
    vi.stubGlobal('location', { reload })
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

  it('resets locally through one empty Core load without storage, URL, or reload work', () => {
    resetData()

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

  it('creates an independent empty document for every reset', () => {
    resetData()
    resetData()

    expect(core.load).toHaveBeenCalledTimes(2)
    const firstDocument = vi.mocked(core.load).mock.calls[0]?.[0]
    const secondDocument = vi.mocked(core.load).mock.calls[1]?.[0]
    expect(firstDocument).toEqual(EMPTY_DOCUMENT)
    expect(secondDocument).toEqual(EMPTY_DOCUMENT)
    expect(firstDocument).not.toBe(secondDocument)
    expect(firstDocument?.sceneTree).not.toBe(secondDocument?.sceneTree)
    expect(firstDocument?.sceneTree.workspaceList).not.toBe(
      secondDocument?.sceneTree.workspaceList
    )
    expect(firstDocument?.sceneTree.elements).not.toBe(
      secondDocument?.sceneTree.elements
    )
    expect(firstDocument?.props).not.toBe(secondDocument?.props)
  })
})
