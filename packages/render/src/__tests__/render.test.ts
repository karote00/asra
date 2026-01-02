import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest'
import { Application, Container } from 'pixi.js'
import { Render } from '../render'
import * as ViewportLayerModule from '../viewport-layer'
import * as SelectionLayerModule from '../selection-layer'
import * as RenderSelectionStore from '../stores/selection'
import { MouseData } from '@asra/utils'
import { RenderContainerData, RenderElementData, SceneElement } from '../types'

// Mock pixi.js Application FIRST
vi.mock('pixi.js', () => {
  const mockAppInstance = {
    init: vi.fn(() => Promise.resolve()),
    stage: {
      addChild: vi.fn(),
      eventMode: ''
    }
  }

  const mockPixiInstance = {
    label: '',
    addChild: vi.fn(),
    removeChild: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    toLocal: vi.fn(),
    position: {
      set: vi.fn()
    },
    scale: {
      set: vi.fn()
    }
  }

  const mockTicker = {
    shared: {
      add: vi.fn(() => vi.fn())
    }
  }

  return {
    Application: vi.fn(() => mockAppInstance),
    Container: vi.fn(() => ({ ...mockPixiInstance })),
    Graphics: vi.fn(() => ({ ...mockPixiInstance })),
    Ticker: mockTicker
  }
})

// Mock renderSelection store
vi.mock('../stores/selection', () => ({
  default: {
    elementSelection: new Set()
  }
}))

describe('Render', () => {
  let render: Render
  let mockApp: Mocked<Application>

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock instances for each test
    vi.mocked(Application).mockClear()

    // Ensure mockApp is the instance returned by Application constructor
    mockApp = new Application() as Mocked<Application>
    vi.mocked(Application).mockImplementation(() => mockApp)

    render = new Render()
  })

  // Test constructor
  it('should instantiate ViewportLayer and SelectionLayer', () => {
    expect(render.viewport).toBeInstanceOf(ViewportLayerModule.ViewportLayer)
    expect(render.selection).toBeInstanceOf(SelectionLayerModule.SelectionLayer)
  })

  // Test init method
  it('should initialize Pixi.js application and set up stage layers', async () => {
    const width = 800
    const height = 600
    const backgroundColor = 0xffffff

    await render.init(width, height, backgroundColor)

    expect(mockApp.init).toHaveBeenCalledWith({
      width,
      height,
      backgroundColor,
      resolution: Math.min(window.devicePixelRatio, 2),
      resizeTo: window,
      antialias: true,
      autoDensity: true
    })
    expect(render.app).toBe(mockApp)
    expect(mockApp.stage.addChild).toHaveBeenCalledTimes(2)
    expect(mockApp.stage.addChild).toHaveBeenCalledWith(render.viewport.view)
    expect(mockApp.stage.addChild).toHaveBeenCalledWith(render.selection.view)
  })

  // Test getSelectedElements
  it('should get selected elements from renderSelection and viewport', () => {
    const mockSceneElements = [new Container(), new Container()]
    mockSceneElements[0].label = 'el1'
    mockSceneElements[1].label = 'el2'
    vi.spyOn(render.viewport, 'getElementById').mockImplementation((id) => {
      return mockSceneElements.find((el) => el.label === id) as SceneElement
    })
    vi.mocked(RenderSelectionStore.default.elementSelection).add('el1')
    vi.mocked(RenderSelectionStore.default.elementSelection).add('el2')

    const result = render.getSelectedElements()

    expect(render.viewport.getElementById).toHaveBeenCalledTimes(2)
    expect(render.viewport.getElementById).toHaveBeenCalledWith('el1')
    expect(render.viewport.getElementById).toHaveBeenCalledWith('el2')
    expect(result).toEqual(mockSceneElements)
  })

  // Test delegation methods to viewport
  it('should delegate switchWorkspace to viewport', () => {
    const data = {
      id: 'ws1',
      type: 'WORKSPACE',
      label: 'ws1',
      x: 0,
      y: 0
    } as unknown as RenderContainerData
    vi.spyOn(render.viewport, 'switchWorkspace')

    render.switchWorkspace(data)

    expect(render.viewport.switchWorkspace).toHaveBeenCalledWith(data)
  })

  it('should delegate addContainer to viewport', () => {
    const data = {
      id: 'cont1',
      type: 'CONTAINER',
      label: 'cont1',
      x: 0,
      y: 0
    } as unknown as RenderContainerData
    vi.spyOn(render.viewport, 'addContainer')

    render.addContainer(data)

    expect(render.viewport.addContainer).toHaveBeenCalledWith(data)
  })

  it('should delegate addElement to viewport', () => {
    const data = {
      id: 'el1',
      type: 'RECTANGLE',
      visible: true,
      name: 'el1',
      lock: false
    } as unknown as RenderElementData
    vi.spyOn(render.viewport, 'addElement')

    render.addElement(data)

    expect(render.viewport.addElement).toHaveBeenCalledWith(data)
  })

  it('should delegate removeElement to viewport', () => {
    vi.spyOn(render.viewport, 'removeElement')

    render.removeElement('el1', 'parent1')

    expect(render.viewport.removeElement).toHaveBeenCalledWith('el1', 'parent1')
  })

  it('should delegate updateElement to viewport', () => {
    const before = 0
    const after = 10
    vi.spyOn(render.viewport, 'updateElement')

    render.updateElement('el1', 'x', before, after)

    expect(render.viewport.updateElement).toHaveBeenCalledWith(
      'el1',
      'x',
      before,
      after
    )
  })

  it('should delegate updateElementProperties to viewport', () => {
    const element = new Container()
    const after = 10
    vi.spyOn(render.viewport, 'updateElementProperties')

    render.updateElementProperties(element, 'x', after)

    expect(render.viewport.updateElementProperties).toHaveBeenCalledWith(
      element,
      'x',
      after
    )
  })

  it('should delegate zoomFit to viewport', () => {
    const uiBounds = new DOMRect(0, 0, 100, 100)
    vi.spyOn(render.viewport, 'zoomFit')

    render.zoomFit(uiBounds)

    expect(render.viewport.zoomFit).toHaveBeenCalledWith(uiBounds)
  })

  it('should delegate panTo to viewport', () => {
    vi.spyOn(render.viewport, 'panTo')

    render.panTo(10, 20)

    expect(render.viewport.panTo).toHaveBeenCalledWith(10, 20)
  })

  it('should delegate zoomTo to viewport', () => {
    vi.spyOn(render.viewport, 'zoomTo')

    render.zoomTo(1.5)

    expect(render.viewport.zoomTo).toHaveBeenCalledWith(1.5)
  })

  it('should delegate zoomToCenter to viewport', () => {
    vi.spyOn(render.viewport, 'zoomToCenter')

    render.zoomToCenter(1.5, 10, 20)

    expect(render.viewport.zoomToCenter).toHaveBeenCalledWith(1.5, 10, 20)
  })

  it('should delegate getViewportPosition to viewport', () => {
    vi.spyOn(render.viewport, 'getPosition')

    render.getViewportPosition()

    expect(render.viewport.getPosition).toHaveBeenCalledTimes(1)
  })

  it('should delegate getViewportScale to viewport', () => {
    vi.spyOn(render.viewport, 'getScale')

    render.getViewportScale()

    expect(render.viewport.getScale).toHaveBeenCalledTimes(1)
  })

  it('should delegate getMousePosInWorkspace to viewport', () => {
    const mouseData = { clientX: 10, clientY: 20 } as MouseData
    vi.spyOn(render.viewport, 'getMousePosInWorkspace')

    render.getMousePosInWorkspace(mouseData)

    expect(render.viewport.getMousePosInWorkspace).toHaveBeenCalledWith(
      mouseData
    )
  })
})
