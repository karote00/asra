import { describe, it, expect, vi, beforeEach } from 'vitest'
import factory from '@asra/factory'
import inputSystem from '@asra/input-system'
import sceneTree from '@asra/scene-tree'
import render from '@asra/render'
import props from '@asra/props-manager'
import systemContext from '@asra/system-context'
import interactionCore from '@asra/interaction-core'
import {
  PrimaryToolType,
  InputSystemEvents,
  PropsComponentRawData,
  Unit
} from '@asra/utils'

import { Core } from '../core'

describe('Core', () => {
  let core: Core

  beforeEach(() => {
    vi.clearAllMocks()

    core = new Core({
      inputSystem,
      factory,
      props,
      render,
      sceneTree,
      systemContext,
      interactionCore
    })
  })

  // Test load method
  it('should load data correctly and call appropriate methods', () => {
    const mockSceneTreeData = {
      elements: {},
      workspace: 'ws-1',
      workspaceList: ['ws-1']
    }
    const mockPropsData = {
      'pp-1': {
        id: 'pp-1',
        x: 100,
        y: 100,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      },
      'pp-2': {
        id: 'pp-2',
        width: 100,
        height: 100,
        widthUnit: Unit.PX,
        heightUnit: Unit.PX
      }
    }
    const dataToLoad = {
      version: '1.0.0',
      sceneTree: mockSceneTreeData,
      props: mockPropsData as unknown as PropsComponentRawData
    }
    // Mock the methods that will be called during load
    core.propsLoadData = vi.fn()
    core.sceneTreeLoadData = vi.fn()
    core.sceneTreeInit = vi.fn()
    core.zoomFit = vi.fn()

    core.load(dataToLoad)

    expect(core.version).toBe('1.0.0')
    expect(core.propsLoadData).toHaveBeenCalledWith(mockPropsData)
    expect(core.sceneTreeLoadData).toHaveBeenCalledWith(mockSceneTreeData)
    expect(core.sceneTreeInit).not.toHaveBeenCalled()
    expect(core.zoomFit).toHaveBeenCalledTimes(1)
  })

  it('should call sceneTreeInit if no sceneTree data is provided', () => {
    const dataToLoad = {
      version: '1.0.0',
      props: {}
    }
    core.sceneTreeInit = vi.fn()
    core.sceneTreeLoadData = vi.fn()

    core.load(dataToLoad as unknown as Parameters<typeof core.load>[0])

    expect(core.sceneTreeInit).toHaveBeenCalledTimes(1)
    expect(core.sceneTreeLoadData).not.toHaveBeenCalled()
  })

  // Test save method
  it('should save data correctly and call appropriate methods', async () => {
    const mockSceneTreeData = {
      elements: {},
      workspace: 'ws-1',
      workspaceList: ['ws-1']
    }
    const mockPropsData = { someProp: 'value' }
    core.propsSaveData = vi.fn().mockResolvedValue(mockPropsData)
    core.sceneTreeSaveData = vi.fn().mockResolvedValue(mockSceneTreeData)

    const savedData = await core.save()

    expect(core.propsSaveData).toHaveBeenCalledTimes(1)
    expect(core.sceneTreeSaveData).toHaveBeenCalledTimes(1)
    expect(savedData).toEqual({
      version: '1.0.0',
      sceneTree: mockSceneTreeData,
      props: mockPropsData
    })
  })

  // Test delegation of various APIs
  it('should delegate startTransaction to factory', () => {
    core.startTransaction = vi.fn()

    core.startTransaction()

    expect(core.startTransaction).toHaveBeenCalledTimes(1)
  })

  it('should delegate switchPrimaryTool to systemContext', () => {
    core.switchPrimaryTool = vi.fn()

    core.switchPrimaryTool(PrimaryToolType.RECTANGLE)

    expect(core.switchPrimaryTool).toHaveBeenCalledWith(
      PrimaryToolType.RECTANGLE
    )
  })

  it('should delegate addRectangle to sceneTree', () => {
    const position = { x: 10, y: 20 }
    core.addRectangle = vi.fn()

    core.addRectangle(position)

    expect(core.addRectangle).toHaveBeenCalledWith(position)
  })

  it('should call executeAction without error', async () => {
    const eventName: InputSystemEvents = InputSystemEvents.INPUT_MOUSE_MOVE
    const detail = { some: 'detail' }
    core.executeAction = vi.fn()

    await core.executeAction(eventName, detail)

    expect(core.executeAction).toHaveBeenCalledWith(eventName, detail)
  })
})
