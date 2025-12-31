import { describe, it, expect, beforeEach } from 'vitest'
import { SystemContext } from '../system-context'
import { KeyState } from '../states/key-state'
import { MouseState } from '../states/mouse-state'
import { PrimaryToolState } from '../states/primary-tool-state'
import { SystemState } from '../states/system-state'
import { TargetState } from '../states/target-state'
import {
  DefaultKeySnapshot,
  DefaultPosition,
  MouseButton,
  PrimaryToolType
} from '@asra/utils'

describe('SystemContext', () => {
  let systemContext: SystemContext
  let keyState: KeyState
  let mouseState: MouseState
  let primaryToolState: PrimaryToolState
  let systemState: SystemState
  let targetState: TargetState

  beforeEach(() => {
    keyState = new KeyState()
    mouseState = new MouseState()
    primaryToolState = new PrimaryToolState()
    systemState = new SystemState()
    targetState = new TargetState()

    systemContext = new SystemContext({
      keyState,
      mouseState,
      primaryToolState,
      systemState,
      targetState
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
    expect(systemContext.getCurrentPrimaryTool()).toEqual(
      PrimaryToolType.SELECT
    )
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
    systemContext.switchPrimaryTool(PrimaryToolType.RECTANGLE)
    expect(systemContext.getCurrentPrimaryTool()).toEqual(
      PrimaryToolType.RECTANGLE
    )
  })

  it('should update key state correctly', () => {
    const newKeySnapshot = { ...DefaultKeySnapshot, shift: true }
    systemContext.updateKeyState(newKeySnapshot)
    expect(systemContext.getKeyState()).toEqual(newKeySnapshot)
  })
})
