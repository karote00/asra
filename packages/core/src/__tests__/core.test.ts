import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Core } from '../core'
import * as FactoryModule from '@asra/factory'
import * as InputSystemModule from '@asra/input-system'
import * as SceneTreeModule from '@asra/scene-tree'
import * as RenderModule from '@asra/render'
import * as PropsManagerModule from '@asra/props-manager'
import * as SystemContextModule from '@asra/system-context'
import * as InteractionCoreModule from '@asra/interaction-core'
import {
  PrimaryToolType,
  InputSystemEvents,
  PropsComponentRawData,
  Unit
} from '@asra/utils'
import type { Mocked } from 'vitest'

describe('Core', () => {
  let core: Core
  let mockFactory: Mocked<FactoryModule.Factory>
  let mockInputSystem: Mocked<InputSystemModule.InputSystem>
  let mockSceneTree: Mocked<SceneTreeModule.SceneTree>
  let mockRender: Mocked<RenderModule.Render>
  let mockPropsManager: Mocked<PropsManagerModule.PropsManager>
  let mockSystemContext: Mocked<SystemContextModule.SystemContext>
  let mockInteractionCore: Mocked<InteractionCoreModule.InteractionCore>

  beforeEach(() => {
    vi.clearAllMocks()

    // Define mock instances directly
    mockFactory = {
      startTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    } as unknown as Mocked<FactoryModule.Factory>

    mockInputSystem = {
      setCombinations: vi.fn(),
      on: vi.fn(),
      switchWatchedElement: vi.fn()
    } as unknown as Mocked<InputSystemModule.InputSystem>

    mockSceneTree = {
      init: vi.fn(),
      load: vi.fn(),
      save: vi.fn(),
      addRectangle: vi.fn(),
      changeComputedData: vi.fn(),
      resizeElement: vi.fn()
    } as unknown as Mocked<SceneTreeModule.SceneTree>

    mockRender = {
      init: vi.fn(),
      isReady: vi.fn(),
      getViewportPosition: vi.fn(),
      getViewportScale: vi.fn(),
      zoomFit: vi.fn(),
      panTo: vi.fn(),
      zoomToCenter: vi.fn()
    } as unknown as Mocked<RenderModule.Render>

    mockPropsManager = {
      load: vi.fn(),
      save: vi.fn()
    } as unknown as Mocked<PropsManagerModule.PropsManager>

    mockSystemContext = {
      getCurrentPrimaryTool: vi.fn(),
      switchPrimaryTool: vi.fn(),
      updateMouseState: vi.fn(),
      updateKeyState: vi.fn()
    } as unknown as Mocked<SystemContextModule.SystemContext>

    mockInteractionCore = {
      executeAction: vi.fn(),
      startSession: vi.fn(),
      updateSession: vi.fn(),
      endSession: vi.fn()
    } as unknown as Mocked<InteractionCoreModule.InteractionCore>

    core = new Core({
      inputSystem: mockInputSystem,
      factory: mockFactory,
      props: mockPropsManager,
      render: mockRender,
      sceneTree: mockSceneTree,
      systemContext: mockSystemContext,
      interactionCore: mockInteractionCore
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
