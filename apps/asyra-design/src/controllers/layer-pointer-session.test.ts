import { describe, expect, it } from 'vitest'
import { FEATURE_MOVEMENT_THRESHOLD } from '../constants'
import {
  cancelLayerPointerSession,
  createLayerPointerSession,
  endLayerPointerSession,
  isLayerPointerBypassTarget,
  updateLayerPointerSession
} from './layer-pointer-session'

describe('Layers hierarchy pointer normalization', () => {
  it('keeps movement below threshold as an ordinary row interaction', () => {
    const start = createLayerPointerSession({
      pointerId: 7,
      sourceElementId: 'shape-a',
      clientX: 10,
      clientY: 20
    })
    const update = updateLayerPointerSession(start, {
      pointerId: 7,
      clientX: 10 + FEATURE_MOVEMENT_THRESHOLD.layerHierarchy - 1,
      clientY: 20,
      target: null
    })
    expect(update).not.toBeNull()
    if (!update) {
      throw new Error('Expected a normalized below-threshold update')
    }
    const end = endLayerPointerSession(update, {
      pointerId: 7,
      clientX: 12,
      clientY: 20,
      target: null
    })

    expect(start).toMatchObject({
      phase: 'start',
      pointerId: 7,
      sourceElementId: 'shape-a',
      dragActive: false
    })
    expect(update.dragActive).toBe(false)
    expect(end).toMatchObject({
      phase: 'end',
      dragActive: false,
      target: null
    })
  })

  it('activates at the documented threshold and retains stable drop ids only', () => {
    const start = createLayerPointerSession({
      pointerId: 8,
      sourceElementId: 'shape-a',
      clientX: 0,
      clientY: 0
    })
    const update = updateLayerPointerSession(start, {
      pointerId: 8,
      clientX: FEATURE_MOVEMENT_THRESHOLD.layerHierarchy,
      clientY: 0,
      target: {
        kind: 'row',
        elementId: 'group-b',
        zone: 'inside'
      }
    })

    expect(update).toMatchObject({
      phase: 'update',
      dragActive: true,
      target: {
        kind: 'row',
        elementId: 'group-b',
        zone: 'inside'
      }
    })
  })

  it('ignores a foreign pointer identity without replacing active state', () => {
    const start = createLayerPointerSession({
      pointerId: 9,
      sourceElementId: 'shape-a',
      clientX: 0,
      clientY: 0
    })

    expect(
      updateLayerPointerSession(start, {
        pointerId: 10,
        clientX: 20,
        clientY: 20,
        target: { kind: 'workspace' }
      })
    ).toBeNull()
    expect(
      endLayerPointerSession(start, {
        pointerId: 10,
        clientX: 20,
        clientY: 20,
        target: { kind: 'workspace' }
      })
    ).toBeNull()
  })

  it.each([
    'escape',
    'pointer-cancel',
    'lost-capture',
    'unmount',
    'outside'
  ] as const)('normalizes %s cleanup exactly once', (reason) => {
    const start = createLayerPointerSession({
      pointerId: 11,
      sourceElementId: 'shape-a',
      clientX: 0,
      clientY: 0
    })
    const cancelled = cancelLayerPointerSession(start, reason)

    expect(cancelled).toMatchObject({
      phase: 'cancel',
      cancellationReason: reason,
      target: null
    })
    expect(cancelLayerPointerSession(cancelled, reason)).toBeNull()
  })

  it('bypasses editable, action, and disclosure targets', () => {
    const input = document.createElement('input')
    const action = document.createElement('button')
    action.dataset.layerPointerBypass = 'true'
    const disclosureChild = document.createElement('span')
    const disclosure = document.createElement('button')
    disclosure.dataset.layerPointerBypass = 'true'
    disclosure.append(disclosureChild)
    const label = document.createElement('span')

    expect(isLayerPointerBypassTarget(input)).toBe(true)
    expect(isLayerPointerBypassTarget(action)).toBe(true)
    expect(isLayerPointerBypassTarget(disclosureChild)).toBe(true)
    expect(isLayerPointerBypassTarget(label)).toBe(false)
  })
})
