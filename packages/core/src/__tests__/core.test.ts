import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Core } from '../core'
import * as FactoryModule from '@asra/factory'
import * as InputSystemModule from '@asra/input-system'
import * as SceneTreeModule from '@asra/scene-tree'
import * as RenderModule from '@asra/render'
import * as PropsManagerModule from '@asra/props-manager'
import * as SystemContextModule from '@asra/system-context'
import * as InteractionCoreModule from '@asra/interaction-core'
import * as SubscribesModule from '../subscribes'
import * as ApisModule from '../apis'
import {
  PrimaryToolType,
  SpecialEvent,
  InputSystemEvents,
  PropsComponentRawData
} from '@asra/utils'
import type { Mocked } from 'vitest'

// Mock reactive-events with hoisted mocks
const { mockExecuteAction, mockRequestSystemContextSnapshot } = vi.hoisted(
  () => ({
    mockExecuteAction: vi.fn(),
    mockRequestSystemContextSnapshot: vi.fn(() =>
      Promise.resolve({
        key: {
          alt: false,
          ctrl: false,
          meta: false,
          shift: false
        },
        mouse: {
          button: 0,
          delta: { x: 0, y: 0 },
          down: false,
          dragStart: { x: 0, y: 0 },
          dragging: false,
          position: { x: 0, y: 0 }
        },
        primaryTool: 'select',
        system: {
          mode: 'DESIGN',
          featureFlags: {},
          permissions: {}
        },
        target: {
          hoveredElementId: null,
          selectedElementIds: [],
          activeElementId: null
        }
      })
    )
  })
)

vi.mock('@asra/reactive-events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@asra/reactive-events')>()
  return {
    ...actual,
    executeAction: mockExecuteAction,
    requestSystemContextSnapshot: mockRequestSystemContextSnapshot
  }
})

// Mock all external dependencies
vi.mock('@asra/factory')
vi.mock('@asra/scene-tree')
vi.mock('@asra/render')
vi.mock('@asra/props-manager')
vi.mock('@asra/system-context')
vi.mock('@asra/interaction-core')
vi.mock('../subscribes')
vi.mock('../apis')

// Mock InputSystem and its internal KeyMap dependency
vi.mock('@asra/input-system', () => {
  const mockKeyMapInstance = {
    mapKey: vi.fn((code: string) => code),
    isModifierKeys: vi.fn((key: string) =>
      ['Meta', 'Control', 'Alt', 'Shift'].includes(key)
    ),
    isSpecialEvent: vi.fn(
      (event: SpecialEvent) => event === SpecialEvent.WHEEL
    ),
    keys: {}
  }

  const mockInputSystemInstance = {
    setCombinations: vi.fn(),
    on: vi.fn(),
    switchWatchedElement: vi.fn(),
    keyMap: mockKeyMapInstance // Provide the mocked keyMap instance
  }

  return {
    InputSystem: vi.fn(() => mockInputSystemInstance),
    default: mockInputSystemInstance // If InputSystem is also default exported
  }
})

// Mock Render module to prevent pixi.js/requestAnimationFrame issues
vi.mock('@asra/render', () => {
  const mockRenderInstance = {
    init: vi.fn(),
    isReady: vi.fn(),
    getViewportPosition: vi.fn(),
    getViewportScale: vi.fn(),
    zoomFit: vi.fn(),
    panTo: vi.fn(),
    zoomToCenter: vi.fn()
  }
  return {
    Render: vi.fn(() => mockRenderInstance),
    default: mockRenderInstance // If Render is also default exported
  }
})

describe('Core', () => {
  let core: Core
  let mockFactory: Mocked<FactoryModule.Factory>
  let mockInputSystem: Mocked<InputSystemModule.InputSystem>
  let mockSceneTree: Mocked<SceneTreeModule.SceneTree>
  let mockRender: Mocked<RenderModule.Render>
  let mockPropsManager: Mocked<PropsManagerModule.PropsManager>
  let mockSystemContext: Mocked<SystemContextModule.SystemContext>
  let mockInteractionCore: Mocked<InteractionCoreModule.InteractionCore>

  const mockApis = {
    startTransaction: vi.fn(),
    endTransaction: vi.fn(),
    setupInputSystem: vi.fn(),
    initRender: vi.fn(),
    renderIsReady: vi.fn(),
    getViewportPosition: vi.fn(),
    getViewportScale: vi.fn(),
    zoomFit: vi.fn(),
    panTo: vi.fn(),
    zoomToCenter: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    sceneTreeInit: vi.fn(),
    sceneTreeLoadData: vi.fn(),
    sceneTreeSaveData: vi.fn(),
    addRectangle: vi.fn(),
    changeComputedData: vi.fn(),
    resizeElement: vi.fn(),
    selectElements: vi.fn(),
    propsLoadData: vi.fn(),
    propsSaveData: vi.fn(),
    getCurrentPrimaryTool: vi.fn(),
    switchPrimaryTool: vi.fn(),
    updateMouseState: vi.fn(),
    updateKeyState: vi.fn(),
    executeAction: vi.fn(),
    startSession: vi.fn(),
    updateSession: vi.fn(),
    endSession: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
    mockExecuteAction.mockClear()
    mockRequestSystemContextSnapshot.mockClear()

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

    // Mock createAPIs to return our mockApis object
    vi.mocked(ApisModule).createAPIs.mockReturnValue(mockApis)

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

  // Test constructor and initialization
  it('should initialize all dependencies and set up APIs', () => {
    // Assert that initAllHandlers is called with the correct mock instances
    expect(SubscribesModule.initAllHandlers).toHaveBeenCalledTimes(1)
    expect(SubscribesModule.initAllHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        inputSystem: mockInputSystem,
        render: mockRender,
        factory: mockFactory,
        interactionCore: mockInteractionCore
      }),
      mockApis
    )
    // Assert that createAPIs is called
    expect(ApisModule.createAPIs).toHaveBeenCalledTimes(1)
    // Assert that core's properties are assigned from mockApis
    expect(core.startTransaction).toBe(mockApis.startTransaction)
    expect(core.zoomFit).toBe(mockApis.zoomFit)
    // Add more assertions for other APIs if needed
  })

  // Test load method
  it('should load data correctly and call appropriate methods', () => {
    const mockSceneTreeData = {
      elements: {},
      workspace: 'ws-1',
      workspaceList: ['ws-1']
    }
    const mockPropsData = { someProp: 'value' }
    const dataToLoad = {
      version: '1.0.0',
      sceneTree: mockSceneTreeData,
      props: mockPropsData as unknown as PropsComponentRawData
    }

    core.load(dataToLoad)

    expect(core.version).toBe('1.0.0')
    expect(mockApis.propsLoadData).toHaveBeenCalledWith(mockPropsData)
    expect(mockApis.sceneTreeLoadData).toHaveBeenCalledWith(mockSceneTreeData)
    expect(mockApis.sceneTreeInit).not.toHaveBeenCalled()
    expect(mockApis.zoomFit).toHaveBeenCalledTimes(1)
  })

  it('should call sceneTreeInit if no sceneTree data is provided', () => {
    const dataToLoad = {
      version: '1.0.0',
      props: {}
    }

    core.load(dataToLoad as unknown as Parameters<typeof core.load>[0])

    expect(mockApis.sceneTreeInit).toHaveBeenCalledTimes(1)
    expect(mockApis.sceneTreeLoadData).not.toHaveBeenCalled()
  })

  // Test save method
  it('should save data correctly and call appropriate methods', async () => {
    const mockSceneTreeData = {
      elements: {},
      workspace: 'ws-1',
      workspaceList: ['ws-1']
    }
    const mockPropsData = { someProp: 'value' }

    mockApis.propsSaveData.mockResolvedValue(mockPropsData)
    mockApis.sceneTreeSaveData.mockResolvedValue(mockSceneTreeData)

    const savedData = await core.save()

    expect(mockApis.propsSaveData).toHaveBeenCalledTimes(1)
    expect(mockApis.sceneTreeSaveData).toHaveBeenCalledTimes(1)
    expect(savedData).toEqual({
      version: '1.0.0',
      sceneTree: mockSceneTreeData,
      props: mockPropsData
    })
  })

  // Test delegation of various APIs
  it('should delegate startTransaction to factory', () => {
    core.startTransaction()
    expect(mockApis.startTransaction).toHaveBeenCalledTimes(1)
  })

  it('should delegate switchPrimaryTool to systemContext', () => {
    core.switchPrimaryTool(PrimaryToolType.RECTANGLE)
    expect(mockApis.switchPrimaryTool).toHaveBeenCalledWith(
      PrimaryToolType.RECTANGLE
    )
  })

  it('should delegate addRectangle to sceneTree', () => {
    const position = { x: 10, y: 20 }
    core.addRectangle(position)
    expect(mockApis.addRectangle).toHaveBeenCalledWith(position)
  })

  it('should call executeAction without error', async () => {
    const eventName: InputSystemEvents = InputSystemEvents.INPUT_MOUSE_MOVE
    const detail = { some: 'detail' }

    await core.executeAction(eventName, detail)
    // If we get here without throwing, the test passes
  })
})
