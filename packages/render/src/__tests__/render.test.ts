import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MouseData } from '@asyra/utils'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import { Render } from '../render'
import * as ViewportLayerModule from '../layers/viewport'
import { RenderContainerData, RenderElementData, SceneElement } from '../types'
import { RenderContainer, RenderGraphics } from '../types/render-object'
import renderStrategyRegistry from '../registries/render-strategy'

describe('Render', () => {
  let render: Render
  let engine: RecordingRenderEngine

  beforeEach(() => {
    vi.clearAllMocks()

    engine = new RecordingRenderEngine({ name: 'render-test' })
    render = new Render({ engine })
  })

  // Test constructor
  it('should instantiate ViewportLayer', () => {
    expect(render.viewport).toBeInstanceOf(ViewportLayerModule.ViewportLayer)
  })

  // Test init method
  it('should initialize the injected engine and set up root layers', async () => {
    const width = 800
    const height = 600
    const backgroundColor = 0xffffff
    const app = await render.init(width, height, backgroundColor)

    expect(render.app).toBe(app)
    expect(engine.getOperations().map((operation) => operation.type)).toEqual([
      'initialize',
      'create-object',
      'create-object',
      'append-child',
      'append-child'
    ])
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
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
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

  it('should not poison render transforms when direct property updates receive invalid values', () => {
    const element = new RenderGraphics()
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
    const element = new RenderContainer()
    const after = 10
    vi.spyOn(render.viewport, 'updateElementProperties')

    render.updateElementProperties(element, 'x', after)

    expect(render.viewport.updateElementProperties).toHaveBeenCalledWith(
      element,
      'x',
      after
    )
  })

  it('should coalesce render requests made during layer updates into the current frame', async () => {
    const appRender = vi.fn()
    const app = await render.init(100, 100, 0)
    app.render = appRender

    let shouldUpdate = true
    render.registerLayer({
      name: 'test-current-frame-request-layer',
      layer: {},
      shouldUpdate: () => shouldUpdate,
      update: () => {
        shouldUpdate = false
        render.requestRender()
        return true
      }
    })

    try {
      render.flushFrame()
      render.flushFrame()
    } finally {
      render.unregisterLayer('test-current-frame-request-layer')
    }

    expect(appRender).toHaveBeenCalledTimes(1)
  })

  it('isolates registered layers between Render instances', () => {
    const secondRender = new Render({
      engine: new RecordingRenderEngine({ name: 'second-render' })
    })
    const firstUpdate = vi.fn(() => true)
    const secondUpdate = vi.fn(() => true)

    render.registerLayer({
      name: 'first-instance-layer',
      layer: {},
      update: firstUpdate
    })
    secondRender.registerLayer({
      name: 'second-instance-layer',
      layer: {},
      update: secondUpdate
    })

    render.updateLayers()

    expect(firstUpdate).toHaveBeenCalledTimes(1)
    expect(secondUpdate).not.toHaveBeenCalled()

    secondRender.updateLayers()

    expect(firstUpdate).toHaveBeenCalledTimes(1)
    expect(secondUpdate).toHaveBeenCalledTimes(1)
  })

  it('evaluates layers by zIndex and stops evaluating an unregistered layer', () => {
    const order: string[] = []
    render.registerLayer({
      name: 'later-layer',
      layer: {},
      zIndex: 20,
      update: () => {
        order.push('later')
        return false
      }
    })
    render.registerLayer({
      name: 'earlier-layer',
      layer: {},
      zIndex: 10,
      update: () => {
        order.push('earlier')
        return false
      }
    })

    render.updateLayers()
    expect(order).toEqual(['earlier', 'later'])

    expect(render.unregisterLayer('earlier-layer')).toBe(true)
    order.length = 0
    render.updateLayers()

    expect(order).toEqual(['later'])
  })

  it('rolls back a layer registration when runtime attachment fails', async () => {
    await render.init(100, 100, 0)
    const execute = engine.execute.bind(engine)
    let failNextLayerAttach = true
    engine.execute = vi.fn((command) => {
      if (
        failNextLayerAttach &&
        command.type === 'create-object' &&
        command.properties?.label === 'failing-layer-root'
      ) {
        failNextLayerAttach = false
        throw new Error('layer attachment failed')
      }
      return execute(command)
    })

    expect(() =>
      render.registerLayer({
        name: 'recoverable-layer',
        layer: new RenderContainer({ label: 'failing-layer-root' })
      })
    ).toThrow('layer attachment failed')

    const replacementUpdate = vi.fn(() => false)
    expect(() =>
      render.registerLayer({
        name: 'recoverable-layer',
        layer: new RenderContainer({ label: 'replacement-layer-root' }),
        update: replacementUpdate
      })
    ).not.toThrow()

    render.updateLayers()
    expect(replacementUpdate).toHaveBeenCalledOnce()
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
    const element = new RenderContainer() as SceneElement
    vi.spyOn(render.viewport, 'getElementById').mockReturnValue(element)

    const result = render.getElementById('el1')

    expect(render.viewport.getElementById).toHaveBeenCalledWith('el1')
    expect(result).toBe(element)
  })

  it('should use the abstract hit-test query in getElementIdAtClientPos', async () => {
    await render.init(100, 100, 0)
    const element = render.addElement({
      id: 'el1',
      type: 'rectangle',
      visible: true,
      name: 'Element',
      lock: false,
      width: 10,
      height: 10
    } as unknown as RenderElementData)
    const target = element?.getEngineHandle() ?? null
    const query = vi.fn(() => ({
      type: 'hit' as const,
      target,
      point: { x: 10, y: 20 }
    }))
    engine.query = query

    const result = render.getElementIdAtClientPos({ x: 10, y: 20 })

    expect(query).toHaveBeenCalledWith({
      type: 'hit-test',
      point: { x: 10, y: 20 }
    })
    expect(result).toBe('el1')
  })

  it('should resolve the nearest labeled parent from an abstract hit', async () => {
    await render.init(100, 100, 0)
    const parent = render.addContainer({ label: 'parentEl', x: 0, y: 0 })
    const element = render.addElement({
      id: 'child',
      type: 'rectangle',
      visible: true,
      name: 'Child',
      lock: false,
      width: 10,
      height: 10
    } as unknown as RenderElementData)
    if (!element) {
      throw new Error('Expected render element')
    }
    parent.addChild(element)
    element.label = ''
    const target = element.getEngineHandle()
    engine.query = vi.fn(() => ({
      type: 'hit' as const,
      target,
      point: { x: 10, y: 20 }
    }))

    const result = render.getElementIdAtClientPos({ x: 10, y: 20 })

    expect(result).toBe('parentEl')
  })

  it('should return null if the abstract hit-test has no target', async () => {
    await render.init(100, 100, 0)
    engine.query = vi.fn(() => ({
      type: 'hit' as const,
      target: null,
      point: { x: 10, y: 20 }
    }))

    const result = render.getElementIdAtClientPos({ x: 10, y: 20 })

    expect(result).toBeNull()
  })
})
