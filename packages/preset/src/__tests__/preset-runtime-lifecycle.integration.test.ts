import { afterEach, describe, expect, it, vi } from 'vitest'
import core from '@asyra/core'
import { renderSceneTreeStore } from '@asyra/render'
import { applyPreset } from '../preset.js'
import { PresetProfiles } from '../constants.js'
import { PresetSystemPropertyKeys } from '../system-property-keys.js'

const empty = {
  version: '1.0.0',
  props: {},
  sceneTree: { workspace: '', workspaceList: [], elements: {} }
}
const start = async (host: HTMLElement) => {
  core.setRenderer({
    name: 'preset-lifecycle-surface',
    init: async () => ({
      canvas: document.createElement('canvas'),
      instance: null
    }),
    destroy: vi.fn(),
    getCanvas: () => null,
    getInstance: () => null,
    getViewportPosition: () => ({ x: 0, y: 0 }),
    getViewportScale: () => 1,
    setViewportPosition: vi.fn(),
    setViewportScale: vi.fn(),
    resize: vi.fn()
  })
  await core.start(host, { width: 100, height: 100 })
}

afterEach(async () => {
  vi.restoreAllMocks()
  if (core.getRuntimeState() === 'active') await core.resetRuntime()
})

describe('Preset complete Core handoff', () => {
  it('reapplies all defaults to a fresh Core without retaining prior load subscriptions or managed state', async () => {
    const first = core,
      host = document.createElement('div')
    applyPreset(first, { profile: PresetProfiles.CUSTOM })
    const oldZoom = first.getSystemPropertyObservable<number>(
      PresetSystemPropertyKeys.ZOOM
    )
    const completed = vi.fn()
    oldZoom?.subscribe({ complete: completed })
    await start(host)
    const next = await first.resetRuntime()
    expect(core).toBe(next)
    expect(completed).toHaveBeenCalledOnce()
    expect(host.querySelectorAll('canvas')).toHaveLength(0)
    expect(next.getRegistrations()).toEqual([])
    expect(next.hasSystemProperty(PresetSystemPropertyKeys.ZOOM)).toBe(false)

    applyPreset(next, { profile: PresetProfiles.CUSTOM })
    const reload = vi.spyOn(renderSceneTreeStore, 'reload')
    next.load(empty)
    expect(reload).toHaveBeenCalledOnce()
    expect(next.getUndoHistoryDepth()).toBe(0)
    await start(host)
    await next.resetRuntime()
    expect(host.querySelectorAll('canvas')).toHaveLength(0)
    applyPreset(core, { profile: PresetProfiles.CUSTOM, defaults: [] })
    expect(core.getRegistrations()).toEqual([])
  })
})
