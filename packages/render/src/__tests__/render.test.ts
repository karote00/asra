import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Application, Container, Graphics } from 'pixi.js'
import { MouseData } from '@asyra/utils'
import { Render } from '../render'
import * as ViewportLayerModule from '../layers/viewport'
import { RenderContainerData, RenderElementData, SceneElement } from '../types'
import renderStrategyRegistry from '../registries/render-strategy'

describe('Render', () => {
  let render: Render

  beforeEach(() => {
    vi.clearAllMocks()

    render = new Render()
  })

  // Test constructor
  it('should instantiate ViewportLayer', () => {
    expect(render.viewport).toBeInstanceOf(ViewportLayerModule.ViewportLayer)
  })

  // Test init method
  it('should initialize Pixi.js application and set up stage layers', async () => {
    const width = 800
    const height = 600
    const backgroundColor = 0xffffff
    const mockInit = vi.fn().mockResolvedValue(undefined)
    const mockApp = {
      init: mockInit,
      stage: {
        eventMode: 'none',
        addChild: vi.fn()
      }
    }
    render['createApplication'] = () => mockApp as unknown as Application

    await render.init(width, height, backgroundColor)

    expect(render.app).toBe(mockApp)
    expect(mockApp.stage.addChild).toHaveBeenCalledTimes(1)
    expect(mockApp.stage.addChild).toHaveBeenCalledWith(render.viewport.view)
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

  it('should keep the scene renderable when one element strategy receives invalid data', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render.switchWorkspace({
      id: 'workspace',
      type: 'WORKSPACE',
      label: 'workspace',
      x: 0,
      y: 0
    } as unknown as RenderContainerData)

    renderStrategyRegistry.register('throwing-test-vector', () => {
      throw new Error('invalid vector topology')
    })
    renderStrategyRegistry.register('safe-test-rect', (graphic, data) => {
      graphic.rect(0, 0, data.width, data.height).fill(0xff00ff)
    })

    expect(() =>
      render.addElement({
        id: 'bad-vector',
        type: 'throwing-test-vector',
        visible: true,
        name: 'Bad Vector',
        lock: false
      } as unknown as RenderElementData)
    ).not.toThrow()
    expect(() =>
      render.addElement({
        id: 'good-rect',
        type: 'safe-test-rect',
        visible: true,
        name: 'Good Rect',
        lock: false,
        width: 24,
        height: 24
      } as unknown as RenderElementData)
    ).not.toThrow()

    expect(render.getElementById('bad-vector')?.visible).toBe(false)
    expect(render.getElementById('good-rect')?.visible).toBe(true)
    expect(errorSpy).toHaveBeenCalledTimes(1)

    renderStrategyRegistry.unregister('throwing-test-vector')
    renderStrategyRegistry.unregister('safe-test-rect')
    errorSpy.mockRestore()
  })

  it('should not poison Pixi transforms when direct property updates receive invalid values', () => {
    const element = new Graphics()
    element.rect(0, 0, 24, 28).fill(0xffffff)
    element.x = 12
    element.y = 16

    render.updateElementProperties(
      element,
      'x',
      Number.NaN as unknown as RenderElementData['x']
    )
    render.updateElementProperties(
      element,
      'y',
      undefined as unknown as RenderElementData['y']
    )
    render.updateElementProperties(
      element,
      'width',
      -1 as unknown as RenderElementData['width']
    )
    render.updateElementProperties(
      element,
      'height',
      Number.POSITIVE_INFINITY as unknown as RenderElementData['height']
    )

    expect(element.x).toBe(12)
    expect(element.y).toBe(16)
    expect(element.width).toBe(24)
    expect(element.height).toBe(28)
  })

  it('should render unknown element types with safe fallback dimensions', () => {
    render.switchWorkspace({
      id: 'workspace',
      type: 'WORKSPACE',
      label: 'workspace',
      x: 0,
      y: 0
    } as unknown as RenderContainerData)

    expect(() =>
      render.addElement({
        id: 'unknown-invalid',
        type: 'unknown-invalid-type',
        visible: true,
        name: 'Unknown Invalid',
        lock: false,
        x: Number.NaN,
        y: undefined,
        width: undefined,
        height: Number.POSITIVE_INFINITY
      } as unknown as RenderElementData)
    ).not.toThrow()

    const element = render.getElementById('unknown-invalid')
    expect(element?.visible).toBe(true)
    expect(element?.x).toBe(0)
    expect(element?.y).toBe(0)
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
      after,
      undefined
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

  it('should delegate getElementById to viewport', () => {
    const element = new Container() as SceneElement
    vi.spyOn(render.viewport, 'getElementById').mockReturnValue(element)

    const result = render.getElementById('el1')

    expect(render.viewport.getElementById).toHaveBeenCalledWith('el1')
    expect(result).toBe(element)
  })

  it('should use Pixi v8 rootBoundary for hit testing in getElementIdAtClientPos', () => {
    const mockHit = { label: 'el1' }
    const mockHitTest = vi.fn().mockReturnValue(mockHit)
    const mockApp = {
      renderer: {
        events: {
          rootBoundary: {
            hitTest: mockHitTest
          }
        }
      }
    }
    render.app = mockApp as unknown as Application

    const result = render.getElementIdAtClientPos({ x: 10, y: 20 })

    expect(mockHitTest).toHaveBeenCalledWith(10, 20)
    expect(result).toBe('el1')
  })

  it('should handle cases where rootBoundary hitTest returns an object without a label', () => {
    const mockHit = { parent: { label: 'parentEl' } }
    const mockHitTest = vi.fn().mockReturnValue(mockHit)
    const mockApp = {
      renderer: {
        events: {
          rootBoundary: {
            hitTest: mockHitTest
          }
        }
      }
    }
    render.app = mockApp as unknown as Application

    const result = render.getElementIdAtClientPos({ x: 10, y: 20 })

    expect(result).toBe('parentEl')
  })

  it('should return null if Pixi v8 events system is not available', () => {
    const mockApp = {
      renderer: {}
    }
    render.app = mockApp as unknown as Application

    const result = render.getElementIdAtClientPos({ x: 10, y: 20 })

    expect(result).toBeNull()
  })
})
