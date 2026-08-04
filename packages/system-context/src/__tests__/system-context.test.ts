import { describe, it, expect, beforeEach } from 'vitest'
import { SystemContext } from '../system-context.js'
import { ManagedPropertyState } from '../states/managed-property-state.js'
import {
  DefaultKeySnapshot,
  DefaultMoseSnapshot,
  DefaultPosition,
  DefaultPrimaryTool,
  DefaultSystemSnapshot,
  DefaultTargetSnapshot,
  MouseButton
} from '@asyra/utils'

describe('SystemContext', () => {
  let systemContext: SystemContext
  let managedPropertyState: ManagedPropertyState

  beforeEach(() => {
    managedPropertyState = new ManagedPropertyState()

    systemContext = new SystemContext({
      managedPropertyState
    })

    systemContext.registerProperty('primaryTool', DefaultPrimaryTool, {
      runtime: true
    })
    systemContext.registerProperty('systemMode', DefaultSystemSnapshot.mode, {
      runtime: true
    })
    systemContext.registerProperty(
      'systemFeatureFlags',
      DefaultSystemSnapshot.featureFlags,
      {
        runtime: true
      }
    )
    systemContext.registerProperty(
      'systemPermissions',
      DefaultSystemSnapshot.permissions,
      {
        runtime: true
      }
    )

    systemContext.registerProperty(
      'mouseDragStart',
      DefaultMoseSnapshot.dragStart,
      {
        runtime: true
      }
    )
    systemContext.registerProperty(
      'mousePosition',
      DefaultMoseSnapshot.position,
      {
        runtime: true
      }
    )
    systemContext.registerProperty('mouseDelta', DefaultMoseSnapshot.delta, {
      runtime: true
    })
    systemContext.registerProperty('mouseButton', DefaultMoseSnapshot.button, {
      runtime: true
    })
    systemContext.registerProperty('mouseDown', DefaultMoseSnapshot.down, {
      runtime: true
    })
    systemContext.registerProperty(
      'mouseDragging',
      DefaultMoseSnapshot.dragging,
      {
        runtime: true
      }
    )

    systemContext.registerProperty('keyShift', DefaultKeySnapshot.shift, {
      runtime: true
    })
    systemContext.registerProperty('keyCtrl', DefaultKeySnapshot.ctrl, {
      runtime: true
    })
    systemContext.registerProperty('keyAlt', DefaultKeySnapshot.alt, {
      runtime: true
    })
    systemContext.registerProperty('keyMeta', DefaultKeySnapshot.meta, {
      runtime: true
    })

    systemContext.registerProperty(
      'hoveredElementId',
      DefaultTargetSnapshot.hoveredElementId,
      {
        runtime: true
      }
    )
    systemContext.registerProperty(
      'selectedElementIds',
      DefaultTargetSnapshot.selectedElementIds,
      {
        runtime: true
      }
    )
    systemContext.registerProperty(
      'activeElementId',
      DefaultTargetSnapshot.activeElementId,
      {
        runtime: true
      }
    )
  })

  it('should initialize with the correct default state', () => {
    const snapshot = systemContext.getSystemContextSnapshot()
    expect(snapshot.keyShift).toEqual(DefaultKeySnapshot.shift)
    expect(snapshot.keyCtrl).toEqual(DefaultKeySnapshot.ctrl)
    expect(snapshot.keyAlt).toEqual(DefaultKeySnapshot.alt)
    expect(snapshot.keyMeta).toEqual(DefaultKeySnapshot.meta)
    expect(snapshot.mouseDragStart).toEqual(DefaultMoseSnapshot.dragStart)
    expect(snapshot.mousePosition).toEqual(DefaultPosition)
    expect(snapshot.mouseDelta).toEqual(DefaultPosition)
    expect(snapshot.mouseButton).toEqual(MouseButton.NONE)
    expect(snapshot.mouseDown).toEqual(false)
    expect(snapshot.mouseDragging).toEqual(false)
    expect(snapshot.primaryTool).toEqual('select')
  })

  it('should update mouse state correctly via managed properties', () => {
    const newMouseSnapshot = {
      position: { x: 100, y: 200 },
      delta: { x: 1, y: 1 },
      button: MouseButton.LEFT,
      down: true,
      dragging: true,
      dragStart: { x: 99, y: 199 }
    }
    systemContext.setManagedProperty(
      'mouseDragStart',
      newMouseSnapshot.dragStart
    )
    systemContext.setManagedProperty('mousePosition', newMouseSnapshot.position)
    systemContext.setManagedProperty('mouseDelta', newMouseSnapshot.delta)
    systemContext.setManagedProperty('mouseButton', newMouseSnapshot.button)
    systemContext.setManagedProperty('mouseDown', newMouseSnapshot.down)
    systemContext.setManagedProperty('mouseDragging', newMouseSnapshot.dragging)
    expect(systemContext.getManagedProperty('mouseDragStart')).toEqual(
      newMouseSnapshot.dragStart
    )
    expect(systemContext.getManagedProperty('mousePosition')).toEqual(
      newMouseSnapshot.position
    )
    expect(systemContext.getManagedProperty('mouseDelta')).toEqual(
      newMouseSnapshot.delta
    )
    expect(systemContext.getManagedProperty('mouseButton')).toEqual(
      newMouseSnapshot.button
    )
    expect(systemContext.getManagedProperty('mouseDown')).toEqual(
      newMouseSnapshot.down
    )
    expect(systemContext.getManagedProperty('mouseDragging')).toEqual(
      newMouseSnapshot.dragging
    )
  })

  it('should update tool state correctly via managed properties', () => {
    systemContext.setManagedProperty('primaryTool', 'rectangle')
    expect(systemContext.getManagedProperty('primaryTool')).toEqual('rectangle')
  })

  it('should update key state correctly via managed properties', () => {
    const newKeySnapshot = { ...DefaultKeySnapshot, shift: true }
    systemContext.setManagedProperty('keyShift', newKeySnapshot.shift)
    systemContext.setManagedProperty('keyCtrl', newKeySnapshot.ctrl)
    systemContext.setManagedProperty('keyAlt', newKeySnapshot.alt)
    systemContext.setManagedProperty('keyMeta', newKeySnapshot.meta)
    expect(systemContext.getManagedProperty('keyShift')).toEqual(
      newKeySnapshot.shift
    )
    expect(systemContext.getManagedProperty('keyCtrl')).toEqual(
      newKeySnapshot.ctrl
    )
    expect(systemContext.getManagedProperty('keyAlt')).toEqual(
      newKeySnapshot.alt
    )
    expect(systemContext.getManagedProperty('keyMeta')).toEqual(
      newKeySnapshot.meta
    )
  })

  it('setManagedProperty should reject runtime values that fail registered type guard', () => {
    systemContext.registerProperty('zoom', 100, { runtime: false })

    systemContext.setManagedProperty('zoom', 120)
    expect(systemContext.getManagedProperty('zoom')).toBe(120)

    systemContext.setManagedProperty('zoom', 'invalid' as unknown as number)
    expect(systemContext.getManagedProperty('zoom')).toBe(120)
  })

  it('loadManagedProperties should apply only valid registered keys and return diagnostics', () => {
    systemContext.registerProperty('zoom', 100, { runtime: false })
    systemContext.registerProperty('pathEditingVectorId', '', {
      runtime: false
    })

    // zoom is valid and applied; other keys are ignored with diagnostics.
    const diagnostics = systemContext.loadManagedProperties({
      zoom: 240,
      pathEditingVectorId: 123,
      unknownKey: true
    })

    expect(systemContext.getManagedProperty('zoom')).toBe(240)
    expect(systemContext.getManagedProperty('pathEditingVectorId')).toBe('')
    expect(diagnostics).toHaveLength(2)
    expect(diagnostics.map((item) => item.path)).toEqual([
      'systemContext.pathEditingVectorId',
      'systemContext.unknownKey'
    ])
  })

  it('separates managed-property load validation from canonical apply', () => {
    systemContext.registerProperty('zoom', 100, { runtime: false })
    systemContext.registerProperty('pathEditingVectorId', '', {
      runtime: false
    })
    const validation = systemContext.validateManagedProperties({
      zoom: 240,
      pathEditingVectorId: 123,
      unknownKey: true
    })

    expect(validation.data).toEqual({ zoom: 240 })
    expect(validation.diagnostics.map((item) => item.path)).toEqual([
      'systemContext.pathEditingVectorId',
      'systemContext.unknownKey'
    ])
    expect(systemContext.getManagedProperty('zoom')).toBe(100)
    expect(systemContext.getManagedProperty('pathEditingVectorId')).toBe('')

    systemContext.applyValidatedManagedProperties(validation)

    expect(systemContext.getManagedProperty('zoom')).toBe(240)
    expect(systemContext.getManagedProperty('pathEditingVectorId')).toBe('')
  })

  it('does not rerun managed-property validators while applying validated data', () => {
    let validationCalls = 0
    systemContext.registerProperty('zoom', 100, {
      runtime: false,
      validate: (value): value is number => {
        validationCalls += 1
        return validationCalls === 1 && typeof value === 'number'
      }
    })

    const validation = systemContext.validateManagedProperties({ zoom: 240 })

    expect(validation.data).toEqual({ zoom: 240 })
    expect(validationCalls).toBe(1)

    systemContext.applyValidatedManagedProperties(validation)

    expect(validationCalls).toBe(1)
    expect(systemContext.getManagedProperty('zoom')).toBe(240)
  })

  it('rejects fabricated, foreign, and reused managed-property artifacts', () => {
    systemContext.registerProperty('zoom', 100, { runtime: false })
    const validation = systemContext.validateManagedProperties({ zoom: 240 })
    const foreignState = new ManagedPropertyState()
    const foreignContext = new SystemContext({
      managedPropertyState: foreignState
    })
    foreignContext.registerProperty('zoom', 100, { runtime: false })
    const forged = {
      data: { zoom: 'invalid' },
      diagnostics: validation.diagnostics
    }

    validation.data.zoom = 'invalid-after-validation'

    expect(() =>
      foreignContext.applyValidatedManagedProperties(validation)
    ).toThrow(/owner-issued.*artifact/i)
    expect(() =>
      systemContext.applyValidatedManagedProperties(forged as typeof validation)
    ).toThrow(/owner-issued.*artifact/i)
    expect(systemContext.getManagedProperty('zoom')).toBe(100)

    systemContext.applyValidatedManagedProperties(validation)

    expect(systemContext.getManagedProperty('zoom')).toBe(240)
    expect(() =>
      systemContext.applyValidatedManagedProperties(validation)
    ).toThrow(/owner-issued.*artifact/i)
  })

  it('saveManagedProperties should serialize registered values as plain object data', () => {
    systemContext.registerProperty('zoom', 100, { runtime: false })
    systemContext.registerProperty('pathEditingVectorId', '', {
      runtime: false
    })
    systemContext.setManagedProperty('zoom', 180)
    systemContext.setManagedProperty('pathEditingVectorId', 'vector-1')

    expect(systemContext.saveManagedProperties()).toEqual({
      zoom: 180,
      pathEditingVectorId: 'vector-1'
    })
  })

  it('runtime-only managed properties should not be saved and should ignore load payload', () => {
    systemContext.registerProperty('pathEditingVectorId', null)

    systemContext.setManagedProperty('pathEditingVectorId', 'vector-1')
    expect(systemContext.saveManagedProperties()).toEqual({})

    const diagnostics = systemContext.loadManagedProperties({
      pathEditingVectorId: 'vector-2'
    })

    expect(systemContext.getManagedProperty('pathEditingVectorId')).toBe(
      'vector-1'
    )
    expect(diagnostics).toEqual([
      {
        key: 'pathEditingVectorId',
        path: 'systemContext.pathEditingVectorId',
        message: 'Ignored runtime-only managed property during load'
      }
    ])
  })

  it('unregisters only the target managed property and completes its observable', () => {
    const state = systemContext.registerProperty('temporary-property', 1)
    let completed = false
    state.subscribe({ complete: () => (completed = true) })

    expect(systemContext.hasManagedProperty('temporary-property')).toBe(true)
    expect(systemContext.unregisterProperty('temporary-property')).toBe(true)
    expect(completed).toBe(true)
    expect(systemContext.hasManagedProperty('temporary-property')).toBe(false)
    expect(
      systemContext.getManagedProperty('temporary-property')
    ).toBeUndefined()
    expect(systemContext.unregisterProperty('temporary-property')).toBe(false)
    expect(systemContext.hasManagedProperty('primaryTool')).toBe(true)
  })
})
