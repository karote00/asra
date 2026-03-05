import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Application, Container } from 'pixi.js'
import { MouseData } from '@asyra/utils'
import { Render } from '../render'
import * as ViewportLayerModule from '../layers/viewport'
import { RenderContainerData, RenderElementData, SceneElement } from '../types'

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
})
