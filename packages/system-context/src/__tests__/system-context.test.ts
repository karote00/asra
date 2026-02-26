import { describe, it, expect, beforeEach } from 'vitest'
import { SystemContext } from '../system-context'
import { KeyState } from '../states/key-state'
import { MouseState } from '../states/mouse-state'
import { PrimaryToolState } from '../states/primary-tool-state'
import { SystemState } from '../states/system-state'
import { TargetState } from '../states/target-state'
import { ManagedPropertyState } from '../states/managed-property-state'
import { DefaultKeySnapshot, DefaultPosition, MouseButton } from '@asyra/utils'

describe('SystemContext', () => {
  let systemContext: SystemContext
  let keyState: KeyState
  let mouseState: MouseState
  let primaryToolState: PrimaryToolState
  let systemState: SystemState
  let targetState: TargetState
  let managedPropertyState: ManagedPropertyState

  beforeEach(() => {
    keyState = new KeyState()
    mouseState = new MouseState()
    primaryToolState = new PrimaryToolState()
    systemState = new SystemState()
    targetState = new TargetState()
    managedPropertyState = new ManagedPropertyState()

    systemContext = new SystemContext({
      keyState,
      mouseState,
      primaryToolState,
      systemState,
      targetState,
      managedPropertyState
    })
  })

  it('should initialize with the correct default state', () => {
    expect(systemContext.getKeyState()).toEqual(DefaultKeySnapshot)
    expect(systemContext.getMouseState()).toEqual({
      dragStart: DefaultPosition,
      position: DefaultPosition,
      delta: DefaultPosition,
      button: MouseButton.NONE,
      down: false,
      dragging: false
    })
    expect(systemContext.getCurrentPrimaryTool()).toEqual('select')
  })

  it('should update mouse state correctly', () => {
    const newMouseSnapshot = {
      position: { x: 100, y: 200 },
      delta: { x: 1, y: 1 },
      button: MouseButton.LEFT,
      down: true,
      dragging: true,
      dragStart: { x: 99, y: 199 }
    }
    systemContext.updateMouseState(newMouseSnapshot)
    expect(systemContext.getMouseState()).toEqual(newMouseSnapshot)
  })

  it('should update tool state correctly', () => {
    systemContext.switchPrimaryTool('rectangle')
    expect(systemContext.getCurrentPrimaryTool()).toEqual('rectangle')
  })

  it('should update key state correctly', () => {
    const newKeySnapshot = { ...DefaultKeySnapshot, shift: true }
    systemContext.updateKeyState(newKeySnapshot)
    expect(systemContext.getKeyState()).toEqual(newKeySnapshot)
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
    systemContext.registerProperty('pathEditingVectorId', '', { runtime: false })

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

  it('saveManagedProperties should serialize registered values as plain object data', () => {
    systemContext.registerProperty('zoom', 100, { runtime: false })
    systemContext.registerProperty('pathEditingVectorId', '', { runtime: false })
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
})
