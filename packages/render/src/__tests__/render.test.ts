import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MouseData } from '@asyra/utils'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import { Render } from '../render.js'
import * as ViewportLayerModule from '../layers/viewport/index.js'
import {
  RenderContainerData,
  RenderElementData,
  SceneElement
} from '../types.js'
import { RenderContainer, RenderGraphics } from '../types/render-object.js'
import renderStrategyRegistry from '../registries/render-strategy.js'

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

  it('should expose only the exact viewport projection count', () => {
    vi.spyOn(render.viewport, 'getProjectedElementCount').mockReturnValue(7077)

    expect(render.getProjectedElementCount()).toBe(7077)
    expect(render.viewport.getProjectedElementCount).toHaveBeenCalledOnce()
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

  it('coalesces pan, zoom, canonical, and computed invalidations into one demanded frame', async () => {
    const updateLayer = vi.fn(() => false)
    await render.init(100, 100, 0)
    const requestFrame = vi.spyOn(engine, 'requestFrame')
    const flushCount = () =>
      engine.getOperations().filter((operation) => operation.type === 'flush')
        .length
    vi.spyOn(render.viewport, 'panTo').mockImplementation(() => undefined)
    vi.spyOn(render.viewport, 'zoomTo').mockImplementation(() => undefined)
    vi.spyOn(render.viewport, 'updateElement').mockImplementation(
      () => undefined
    )
    render.registerLayer({
      name: 'demand-driven-layer',
      layer: {},
      update: updateLayer
    })

    render.start()
    expect(updateLayer).toHaveBeenCalledOnce()
    expect(flushCount()).toBe(1)
    expect(requestFrame).not.toHaveBeenCalled()

    engine.emitFrame(1)
    expect(updateLayer).toHaveBeenCalledOnce()
    expect(flushCount()).toBe(1)

    render.panTo(12, 24)
    render.zoomTo(1.5)
    render.updateElement('canonical-element', 'visible', true, false)
    render.updateElement(
      'computed-element',
      'computed',
      undefined as never,
      undefined as never,
      {
        id: 'computed-element',
        type: 'vector'
      } as RenderElementData
    )
    expect(requestFrame).toHaveBeenCalledOnce()
    expect(flushCount()).toBe(1)

    engine.emitFrame(2)
    expect(updateLayer).toHaveBeenCalledTimes(2)
    expect(flushCount()).toBe(2)

    engine.emitFrame(3)
    expect(updateLayer).toHaveBeenCalledTimes(2)
    expect(requestFrame).toHaveBeenCalledOnce()
    expect(flushCount()).toBe(2)
  })

  it('does not loop a failed frame without a new invalidation', async () => {
    const app = await render.init(100, 100, 0)
    render.start()
    const renderFailure = new Error('render failed')
    app.render = vi.fn(() => {
      throw renderFailure
    })

    render.requestRender()
    expect(() => engine.emitFrame(1)).toThrow(renderFailure)
    expect(() => engine.emitFrame(2)).not.toThrow()
    expect(app.render).toHaveBeenCalledOnce()
  })

  it('notifies isolated frame-complete subscribers after a successful frame', async () => {
    await render.init(100, 100, 0)
    render.start()
    const firstSubscriber = vi.fn()
    const laterSubscriber = vi.fn()
    const disposeFirst = render.subscribeToFrameComplete(firstSubscriber)
    render.subscribeToFrameComplete(() => {
      throw new Error('frame observer failed')
    })
    render.subscribeToFrameComplete(laterSubscriber)

    render.requestRender()
    expect(() => engine.emitFrame(1)).not.toThrow()

    expect(firstSubscriber).toHaveBeenCalledOnce()
    expect(laterSubscriber).toHaveBeenCalledOnce()

    disposeFirst()
    render.requestRender()
    expect(() => engine.emitFrame(2)).not.toThrow()
    expect(firstSubscriber).toHaveBeenCalledOnce()
    expect(laterSubscriber).toHaveBeenCalledTimes(2)
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

    let failedElement: SceneElement | undefined
    expect(() => {
      failedElement = render.addElement({
        id: 'bad-vector',
        type: 'throwing-test-vector',
        visible: true,
        name: 'Bad Vector',
        lock: false
      } as unknown as RenderElementData)
    }).not.toThrow()
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

    expect(failedElement).toBeUndefined()
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

  it('destroys removed nodes and recreates them without prior-engine handles', async () => {
    const firstEngine = new RecordingRenderEngine({ name: 'remove-first' })
    const lifecycleRender = new Render({ engine: firstEngine })
    await lifecycleRender.init(100, 100, 0, {})
    lifecycleRender.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const initialData = {
      id: 'remove-readd-element',
      type: 'rectangle',
      name: 'Initial',
      visible: true,
      lock: false,
      width: 20,
      height: 20
    } as unknown as RenderElementData
    const initialNode = lifecycleRender.addElement(initialData)
    const initialHandle = initialNode?.getEngineHandle()

    expect(initialHandle).not.toBeNull()
    lifecycleRender.removeElement(initialData.id)

    expect(initialNode?.getEngineHandle()).toBeNull()
    expect(
      firstEngine
        .getOperations()
        .filter((operation) => operation.type === 'destroy-object')
    ).toHaveLength(1)

    lifecycleRender.dispose()
    const secondEngine = new RecordingRenderEngine({ name: 'remove-second' })
    lifecycleRender.setEngine(secondEngine)
    await lifecycleRender.init(100, 100, 0, {})
    lifecycleRender.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const recreatedNode = lifecycleRender.addElement({
      ...initialData,
      name: 'Recreated',
      width: 40
    })

    expect(recreatedNode).not.toBe(initialNode)
    expect(recreatedNode?.getEngineHandle()).not.toBe(initialHandle)
    expect(
      secondEngine
        .getOperations()
        .some(
          (operation) =>
            operation.type === 'create-object' &&
            operation.command.requestId === initialData.id
        )
    ).toBe(true)

    lifecycleRender.dispose()
  })

  it('retains a node for retry when the engine destroy command fails', async () => {
    const retryEngine = new RecordingRenderEngine({ name: 'remove-retry' })
    const retryRender = new Render({ engine: retryEngine })
    await retryRender.init(100, 100, 0, {})
    retryRender.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const node = retryRender.addElement({
      id: 'retry-element',
      type: 'rectangle',
      name: 'Retry Element',
      visible: true,
      lock: false,
      width: 20,
      height: 20
    } as unknown as RenderElementData)
    expect(node).toBeDefined()
    const initialHandle = node?.getEngineHandle()
    const originalExecute = retryEngine.execute.bind(retryEngine)
    let shouldFailDestroy = true
    vi.spyOn(retryEngine, 'execute').mockImplementation((command) => {
      if (command.type === 'destroy-object' && shouldFailDestroy) {
        shouldFailDestroy = false
        throw new Error('destroy failed')
      }
      return originalExecute(command)
    })

    expect(() => retryRender.removeElement('retry-element')).toThrow(
      'destroy failed'
    )
    expect(retryRender.getElementById('retry-element')).toBe(node)
    expect(node?.getEngineHandle()).toBe(initialHandle)

    expect(() => retryRender.removeElement('retry-element')).not.toThrow()
    expect(retryRender.getElementById('retry-element')).toBeUndefined()
    expect(node?.getEngineHandle()).toBeNull()

    retryRender.dispose()
  })

  it('keeps the active runtime intact when teardown projection cleanup fails', async () => {
    const teardownEngine = new RecordingRenderEngine({
      name: 'teardown-cleanup-retry'
    })
    const teardownRender = new Render({ engine: teardownEngine })
    await teardownRender.init(100, 100, 0, {})
    teardownRender.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const node = teardownRender.addElement({
      id: 'teardown-retry-element',
      type: 'rectangle',
      name: 'Teardown Retry Element',
      visible: true,
      lock: false,
      width: 20,
      height: 20
    } as unknown as RenderElementData)
    const initialApp = teardownRender.app
    const initialHandle = node?.getEngineHandle()
    const originalExecute = teardownEngine.execute.bind(teardownEngine)
    let shouldFailDestroy = true
    vi.spyOn(teardownEngine, 'execute').mockImplementation((command) => {
      if (command.type === 'destroy-object' && shouldFailDestroy) {
        shouldFailDestroy = false
        throw new Error('teardown cleanup failed')
      }
      return originalExecute(command)
    })
    teardownRender.registerTeardownCleanup(() => {
      teardownRender.removeElement('teardown-retry-element')
    })

    expect(() => teardownRender.dispose()).toThrow('teardown cleanup failed')
    expect(teardownRender.app).toBe(initialApp)
    expect(teardownRender.getElementById('teardown-retry-element')).toBe(node)
    expect(node?.getEngineHandle()).toBe(initialHandle)
    expect(
      teardownEngine
        .getOperations()
        .some((operation) => operation.type === 'destroy')
    ).toBe(false)

    expect(() => teardownRender.dispose()).not.toThrow()
    expect(teardownRender.app).toBeNull()
    expect(
      teardownEngine
        .getOperations()
        .map((operation) => operation.type)
        .filter((operation) => operation === 'destroy-object')
    ).toHaveLength(1)
    expect(teardownEngine.getOperations().at(-1)?.type).toBe('destroy')
  })

  it('preserves live children when a projected parent is removed and re-added', async () => {
    const hierarchyEngine = new RecordingRenderEngine({
      name: 'parent-remove-readd'
    })
    const hierarchyRender = new Render({ engine: hierarchyEngine })
    await hierarchyRender.init(100, 100, 0, {})
    hierarchyRender.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const childData = {
      id: 'child-1',
      parentId: 'group-1',
      type: 'rectangle',
      name: 'Child',
      visible: true,
      lock: false,
      width: 20,
      height: 20
    } as unknown as RenderElementData
    const parentData = {
      id: 'group-1',
      type: 'group',
      name: 'Group',
      visible: true,
      lock: false,
      children: ['child-1']
    } as unknown as RenderElementData
    const child = hierarchyRender.addElement(childData)
    const parent = hierarchyRender.addElement(parentData)
    if (!child || !parent) {
      throw new Error('Expected parent and child render nodes')
    }
    expect(child.parent).toBe(parent)
    const childHandle = child.getEngineHandle()
    const parentHandle = parent.getEngineHandle()
    const destroyCountBefore = hierarchyEngine
      .getOperations()
      .filter((operation) => operation.type === 'destroy-object').length

    hierarchyRender.removeElement(parentData.id)

    expect(child.getEngineHandle()).toBe(childHandle)
    expect(hierarchyRender.getElementById(childData.id)).toBe(child)
    expect(child.parent).toBeNull()
    expect(
      hierarchyEngine
        .getOperations()
        .filter((operation) => operation.type === 'destroy-object')
    ).toHaveLength(destroyCountBefore + 1)

    const recreatedParent = hierarchyRender.addElement(parentData)

    expect(recreatedParent).not.toBe(parent)
    expect(recreatedParent?.getEngineHandle()).not.toBe(parentHandle)
    expect(child.getEngineHandle()).toBe(childHandle)
    expect(child.parent).toBe(recreatedParent)

    hierarchyRender.dispose()
  })

  it('retries a failed child detach before destroying a projected parent', async () => {
    const retryEngine = new RecordingRenderEngine({
      name: 'parent-detach-retry'
    })
    const retryRender = new Render({ engine: retryEngine })
    await retryRender.init(100, 100, 0, {})
    retryRender.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const childData = {
      id: 'detach-retry-child',
      parentId: 'detach-retry-parent',
      type: 'rectangle',
      name: 'Detach Retry Child',
      visible: true,
      lock: false,
      width: 20,
      height: 20
    } as unknown as RenderElementData
    const parentData = {
      id: 'detach-retry-parent',
      type: 'group',
      name: 'Detach Retry Parent',
      visible: true,
      lock: false,
      children: ['detach-retry-child']
    } as unknown as RenderElementData
    const child = retryRender.addElement(childData)
    const parent = retryRender.addElement(parentData)
    if (!child || !parent) {
      throw new Error('Expected retry parent and child render nodes')
    }
    const childHandle = child.getEngineHandle()
    const parentHandle = parent.getEngineHandle()
    const originalExecute = retryEngine.execute.bind(retryEngine)
    let shouldFailDetach = true
    const executeSpy = vi
      .spyOn(retryEngine, 'execute')
      .mockImplementation((command) => {
        if (
          command.type === 'remove-child' &&
          command.child === childHandle &&
          shouldFailDetach
        ) {
          shouldFailDetach = false
          throw new Error('child detach failed')
        }
        return originalExecute(command)
      })

    expect(() => retryRender.removeElement(parentData.id)).toThrow(
      'child detach failed'
    )
    expect(retryRender.getElementById(parentData.id)).toBe(parent)
    expect(parent.children).toContain(child)
    expect(child.parent).toBe(parent)
    expect(parent.getEngineHandle()).toBe(parentHandle)
    expect(child.getEngineHandle()).toBe(childHandle)

    expect(() => retryRender.removeElement(parentData.id)).not.toThrow()
    expect(retryRender.getElementById(parentData.id)).toBeUndefined()
    expect(parent.getEngineHandle()).toBeNull()
    expect(child.parent).toBeNull()
    expect(child.getEngineHandle()).toBe(childHandle)
    expect(
      executeSpy.mock.calls.filter(
        ([command]) =>
          command.type === 'remove-child' && command.child === childHandle
      )
    ).toHaveLength(2)

    retryRender.dispose()
  })

  it('retries a failed hierarchy append from the same complete snapshot', async () => {
    await render.init(100, 100, 0, {})
    render.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const childData = {
      id: 'append-retry-child',
      type: 'rectangle',
      visible: true,
      width: 20,
      height: 20
    } as unknown as RenderElementData
    const parentData = {
      id: 'append-retry-parent',
      type: 'group',
      visible: true,
      children: []
    } as unknown as RenderElementData
    const child = render.addElement(childData)
    const parent = render.addElement(parentData)
    if (!child || !parent) {
      throw new Error('Expected append retry nodes')
    }
    const previousParent = child.parent
    if (!previousParent) {
      throw new Error('Expected the child to start in the workspace')
    }
    const childHandle = child.getEngineHandle()
    const parentHandle = parent.getEngineHandle()
    const originalExecute = engine.execute.bind(engine)
    let shouldFailAppend = true
    const executeSpy = vi
      .spyOn(engine, 'execute')
      .mockImplementation((command) => {
        if (
          command.type === 'append-child' &&
          command.parent === parentHandle &&
          command.child === childHandle &&
          shouldFailAppend
        ) {
          shouldFailAppend = false
          throw new Error('hierarchy append failed')
        }
        return originalExecute(command)
      })
    const completeParentData = {
      ...parentData,
      children: [childData.id]
    }

    expect(() =>
      render.updateElement(
        parentData.id,
        'computed',
        undefined,
        undefined,
        completeParentData
      )
    ).toThrow('hierarchy append failed')
    expect(parent.children).toEqual([])
    expect(previousParent.children).toContain(child)
    expect(child.parent).toBe(previousParent)

    expect(() =>
      render.updateElement(
        parentData.id,
        'computed',
        undefined,
        undefined,
        completeParentData
      )
    ).not.toThrow()
    expect(child.parent).toBe(parent)
    expect(previousParent.children).not.toContain(child)
    expect(parent.children).toEqual([child])
    expect(
      executeSpy.mock.calls.filter(
        ([command]) =>
          command.type === 'append-child' &&
          command.parent === parentHandle &&
          command.child === childHandle
      )
    ).toHaveLength(2)
  })

  it.each(['append-child', 'set-child-index'] as const)(
    'preserves the previous parent when a reparent %s handoff fails',
    async (failureCommand) => {
      await render.init(100, 100, 0, {})
      render.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
      const childData = {
        id: 'reparent-retry-child',
        type: 'rectangle',
        visible: true,
        width: 20,
        height: 20
      } as unknown as RenderElementData
      const previousParentData = {
        id: 'reparent-retry-previous-parent',
        type: 'group',
        visible: true,
        children: [childData.id]
      } as unknown as RenderElementData
      const nextParentData = {
        id: 'reparent-retry-next-parent',
        type: 'group',
        visible: true,
        children: []
      } as unknown as RenderElementData
      const child = render.addElement(childData)
      const previousParent = render.addElement(previousParentData)
      const nextParent = render.addElement(nextParentData)
      if (!child || !previousParent || !nextParent) {
        throw new Error('Expected reparent retry nodes')
      }
      const childHandle = child.getEngineHandle()
      const previousParentHandle = previousParent.getEngineHandle()
      const nextParentHandle = nextParent.getEngineHandle()
      const originalExecute = engine.execute.bind(engine)
      let shouldFailHandoff = true
      let currentEngineParent = previousParentHandle
      const executeSpy = vi
        .spyOn(engine, 'execute')
        .mockImplementation((command) => {
          if ('child' in command && command.child === childHandle) {
            if (command.type === 'remove-child') {
              if (command.parent !== currentEngineParent) {
                throw new Error('remove-child parent mismatch')
              }
              const result = originalExecute(command)
              currentEngineParent = null
              return result
            }
            if (command.type === 'append-child') {
              if (
                currentEngineParent !== null &&
                currentEngineParent !== command.parent
              ) {
                throw new Error('engine requires explicit remove before append')
              }
              if (
                command.parent === nextParentHandle &&
                failureCommand === 'append-child' &&
                shouldFailHandoff
              ) {
                shouldFailHandoff = false
                throw new Error('append-child reparent failed')
              }
              const result = originalExecute(command)
              currentEngineParent = command.parent
              return result
            }
            if (command.type === 'set-child-index') {
              if (command.parent !== currentEngineParent) {
                throw new Error('set-child-index parent mismatch')
              }
              if (
                command.parent === nextParentHandle &&
                failureCommand === 'set-child-index' &&
                shouldFailHandoff
              ) {
                shouldFailHandoff = false
                throw new Error('set-child-index reparent failed')
              }
            }
          }
          return originalExecute(command)
        })
      const completeNextParentData = {
        ...nextParentData,
        children: [childData.id]
      }

      expect(() =>
        render.updateElement(
          nextParentData.id,
          'computed',
          undefined,
          undefined,
          completeNextParentData
        )
      ).toThrow(`${failureCommand} reparent failed`)
      expect(previousParent.children).toEqual([child])
      expect(nextParent.children).toEqual([])
      expect(child.parent).toBe(previousParent)
      expect(currentEngineParent).toBe(previousParentHandle)

      expect(() =>
        render.updateElement(
          nextParentData.id,
          'computed',
          undefined,
          undefined,
          completeNextParentData
        )
      ).not.toThrow()
      expect(previousParent.children).toEqual([])
      expect(nextParent.children).toEqual([child])
      expect(child.parent).toBe(nextParent)
      expect(currentEngineParent).toBe(nextParentHandle)
      expect(
        executeSpy.mock.calls.filter(
          ([command]) =>
            command.type === 'append-child' &&
            command.parent === nextParentHandle &&
            command.child === childHandle
        )
      ).toHaveLength(2)
      expect(
        executeSpy.mock.calls.filter(
          ([command]) =>
            command.type === 'remove-child' &&
            command.parent === previousParentHandle &&
            command.child === childHandle
        )
      ).toHaveLength(2)
      expect(
        executeSpy.mock.calls.filter(
          ([command]) =>
            command.type === 'append-child' &&
            command.parent === previousParentHandle &&
            command.child === childHandle
        )
      ).toHaveLength(1)
    }
  )

  it('retries a failed sibling reorder from the same complete snapshot', async () => {
    await render.init(100, 100, 0, {})
    render.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const firstData = {
      id: 'reorder-first',
      type: 'rectangle',
      visible: true,
      width: 20,
      height: 20
    } as unknown as RenderElementData
    const secondData = {
      ...firstData,
      id: 'reorder-second'
    }
    const parentData = {
      id: 'reorder-parent',
      type: 'group',
      visible: true,
      children: [firstData.id, secondData.id]
    } as unknown as RenderElementData
    const first = render.addElement(firstData)
    const second = render.addElement(secondData)
    const parent = render.addElement(parentData)
    if (!first || !second || !parent) {
      throw new Error('Expected reorder retry nodes')
    }
    const secondHandle = second.getEngineHandle()
    const parentHandle = parent.getEngineHandle()
    const originalExecute = engine.execute.bind(engine)
    let shouldFailReorder = true
    const executeSpy = vi
      .spyOn(engine, 'execute')
      .mockImplementation((command) => {
        if (
          command.type === 'set-child-index' &&
          command.parent === parentHandle &&
          command.child === secondHandle &&
          shouldFailReorder
        ) {
          shouldFailReorder = false
          throw new Error('sibling reorder failed')
        }
        return originalExecute(command)
      })
    const reorderedParentData = {
      ...parentData,
      children: [secondData.id, firstData.id]
    }

    expect(() =>
      render.updateElement(
        parentData.id,
        'computed',
        undefined,
        undefined,
        reorderedParentData
      )
    ).toThrow('sibling reorder failed')
    expect(parent.children).toEqual([first, second])

    expect(() =>
      render.updateElement(
        parentData.id,
        'computed',
        undefined,
        undefined,
        reorderedParentData
      )
    ).not.toThrow()
    expect(parent.children).toEqual([second, first])
    expect(
      executeSpy.mock.calls.filter(
        ([command]) =>
          command.type === 'set-child-index' && command.child === secondHandle
      )
    ).toHaveLength(2)
  })

  it('retains handle lookup until a failed destroy can be retried', async () => {
    await render.init(100, 100, 0, {})
    render.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const elementData = {
      id: 'destroy-lookup-retry',
      type: 'rectangle',
      visible: true,
      width: 20,
      height: 20
    } as unknown as RenderElementData
    const element = render.addElement(elementData)
    if (!element) {
      throw new Error('Expected destroy retry node')
    }
    const handle = element.getEngineHandle()
    const originalExecute = engine.execute.bind(engine)
    let shouldFailDestroy = true
    const executeSpy = vi
      .spyOn(engine, 'execute')
      .mockImplementation((command) => {
        if (
          command.type === 'destroy-object' &&
          command.object === handle &&
          shouldFailDestroy
        ) {
          shouldFailDestroy = false
          throw new Error('destroy lookup failed')
        }
        return originalExecute(command)
      })
    const querySpy = vi.spyOn(engine, 'query').mockReturnValue({
      type: 'hit',
      target: handle,
      point: { x: 5, y: 5 }
    })

    expect(() => render.removeElement(elementData.id)).toThrow(
      'destroy lookup failed'
    )
    expect(render.getElementIdAtClientPos({ x: 5, y: 5 })).toBe(elementData.id)

    expect(() => render.removeElement(elementData.id)).not.toThrow()
    expect(element.getEngineHandle()).toBeNull()
    expect(
      executeSpy.mock.calls.filter(
        ([command]) =>
          command.type === 'destroy-object' && command.object === handle
      )
    ).toHaveLength(2)
    querySpy.mockRestore()
  })

  it('synchronizes hierarchy from complete snapshots without reordering stable siblings', () => {
    render.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const firstData = {
      id: 'stable-first',
      type: 'rectangle',
      name: 'Stable First',
      visible: true,
      lock: false,
      width: 20,
      height: 20
    } as unknown as RenderElementData
    const secondData = {
      ...firstData,
      id: 'stable-second',
      name: 'Stable Second'
    }
    const targetData = {
      ...firstData,
      id: 'target-child',
      name: 'Target Child'
    }
    const groupData = {
      id: 'group-1',
      type: 'group',
      name: 'Group',
      visible: true,
      lock: false,
      children: ['target-child']
    } as unknown as RenderElementData
    const first = render.addElement(firstData)
    const second = render.addElement(secondData)
    const target = render.addElement(targetData)
    const group = render.addElement(groupData)
    if (!first || !second || !target || !group || !group.parent) {
      throw new Error('Expected hierarchy render nodes')
    }
    const workspace = group.parent
    const stableOrder = workspace.children.map((child) => child.label)

    render.updateElement(
      firstData.id,
      'computed',
      undefined,
      undefined,
      firstData
    )

    expect(workspace.children.map((child) => child.label)).toEqual(stableOrder)
    expect(target.parent).toBe(group)

    render.updateElement(groupData.id, 'computed', undefined, undefined, {
      ...groupData,
      children: []
    })

    expect(group.children).toEqual([])
    expect(target.parent).toBeNull()

    render.updateElement(targetData.id, 'computed', undefined, undefined, {
      ...targetData,
      parentId: groupData.id
    })

    expect(target.parent).toBe(group)
    expect(group.children.map((child) => child.label)).toEqual([targetData.id])
  })

  it('projects canonical reparent and reorder with the same node and engine handle', async () => {
    await render.init(100, 100, 0, {})
    render.switchWorkspace({ label: 'workspace-1', x: 0, y: 0 })
    const childData = {
      id: 'identity-child',
      type: 'rectangle',
      visible: true,
      width: 20,
      height: 20,
      parentId: 'identity-source'
    } as unknown as RenderElementData
    const siblingData = {
      ...childData,
      id: 'identity-sibling',
      parentId: 'identity-target'
    }
    const sourceData = {
      id: 'identity-source',
      type: 'group',
      visible: true,
      children: [childData.id]
    } as unknown as RenderElementData
    const targetData = {
      id: 'identity-target',
      type: 'group',
      visible: true,
      children: [siblingData.id]
    } as unknown as RenderElementData
    const child = render.addElement(childData)
    const sibling = render.addElement(siblingData)
    const source = render.addElement(sourceData)
    const target = render.addElement(targetData)
    if (!child || !sibling || !source || !target) {
      throw new Error('Expected identity-safe hierarchy nodes')
    }
    const childHandle = child.getEngineHandle()

    render.projectHierarchy(targetData.id, [siblingData.id, childData.id])
    render.projectHierarchy(sourceData.id, [])

    expect(render.getElementById(childData.id)).toBe(child)
    expect(child.getEngineHandle()).toBe(childHandle)
    expect(child.parent).toBe(target)
    expect(target.children).toEqual([sibling, child])

    render.projectHierarchy(targetData.id, [childData.id, siblingData.id])

    expect(render.getElementById(childData.id)).toBe(child)
    expect(child.getEngineHandle()).toBe(childHandle)
    expect(target.children).toEqual([child, sibling])
    expect(
      engine
        .getOperations()
        .filter(
          (operation) =>
            operation.type === 'destroy-object' &&
            operation.command.object === childHandle
        )
    ).toHaveLength(0)
  })

  it('clears workspace identity and transform with scene elements', async () => {
    const workspaceEngine = new RecordingRenderEngine({
      name: 'workspace-reset'
    })
    const workspaceRender = new Render({ engine: workspaceEngine })
    await workspaceRender.init(100, 100, 0, {})
    workspaceRender.switchWorkspace({ label: 'workspace-old', x: 24, y: 36 })
    const resetStartIndex = workspaceEngine.getOperations().length

    workspaceRender.clearElements()

    const resetProperties = workspaceEngine
      .getOperations()
      .slice(resetStartIndex)
      .flatMap((operation) =>
        operation.type === 'update-object' ? [operation.command.properties] : []
      )
    expect(resetProperties).toContainEqual({ label: '' })
    expect(resetProperties).toContainEqual({ x: 0 })
    expect(resetProperties).toContainEqual({ y: 0 })

    workspaceRender.dispose()
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

  it('converts between workspace and element-local coordinates through Render ancestry', () => {
    const element = new RenderGraphics()
    element.x = 10
    element.y = 20
    render.viewport.view.x = 100
    render.viewport.view.y = 50
    render.viewport.view.scale.set(2, 2)
    render.viewport.view.addChild(element)
    vi.spyOn(render.viewport, 'getElementById').mockImplementation(
      (elementId) => (elementId === 'vector-1' ? element : undefined)
    )

    expect(
      render.workspaceToElementLocal('vector-1', { x: 15, y: 27 })
    ).toEqual({ x: 5, y: 7 })
    expect(render.elementLocalToWorkspace('vector-1', { x: 5, y: 7 })).toEqual({
      x: 15,
      y: 27
    })
    expect(
      render.workspaceToElementLocal('missing', { x: 15, y: 27 })
    ).toBeNull()
  })

  it('converts between strategy source space and workspace through the last projected source origin', () => {
    const element = new RenderGraphics()
    element.x = 10
    element.y = 20
    element.setSourceSpaceOrigin({ x: 30, y: 40 })
    render.viewport.view.addChild(element)
    vi.spyOn(render.viewport, 'getElementById').mockImplementation(
      (elementId) => (elementId === 'vector-1' ? element : undefined)
    )

    expect(
      render.elementSourceToWorkspace('vector-1', { x: 35, y: 47 })
    ).toEqual({ x: 15, y: 27 })
    expect(
      render.workspaceToElementSource('vector-1', { x: 15, y: 27 })
    ).toEqual({ x: 35, y: 47 })
    expect(
      render.elementSourceToWorkspace('missing', { x: 35, y: 47 })
    ).toBeNull()
  })

  it('projects workspace coordinates into the renderer canvas', () => {
    render.viewport.view.x = 100
    render.viewport.view.y = 50
    render.viewport.view.scale.set(2, 2)

    expect(render.workspaceToCanvas({ x: 15, y: 27 })).toEqual({
      x: 130,
      y: 104
    })
  })

  it('passes complete vector and non-vector snapshots through the same strategy signature', () => {
    const vectorStrategy = vi.fn()
    const rectangleStrategy = vi.fn()
    const vectorData = {
      id: 'vector-complete-data',
      type: 'complete-data-vector',
      visible: true,
      name: 'Vector',
      lock: false,
      points: { point1: { x: 10, y: 20 } },
      fills: { fill1: { color: 0xff00ff } }
    } as unknown as RenderElementData
    const rectangleData = {
      id: 'rectangle-complete-data',
      type: 'complete-data-rectangle',
      visible: true,
      name: 'Rectangle',
      lock: false,
      x: 12,
      y: 16,
      width: 80,
      height: 60
    } as unknown as RenderElementData

    renderStrategyRegistry.register(vectorData.type, vectorStrategy)
    renderStrategyRegistry.register(rectangleData.type, rectangleStrategy)

    try {
      render.addElement(vectorData)
      render.addElement(rectangleData)

      expect(vectorStrategy).toHaveBeenCalledTimes(1)
      expect(vectorStrategy.mock.calls[0]?.[1]).toBe(vectorData)
      expect(rectangleStrategy).toHaveBeenCalledTimes(1)
      expect(rectangleStrategy.mock.calls[0]?.[1]).toBe(rectangleData)
    } finally {
      renderStrategyRegistry.unregister(vectorData.type)
      renderStrategyRegistry.unregister(rectangleData.type)
    }
  })

  it('emits the same draw trace from a delta snapshot and a fresh snapshot', async () => {
    const strategyType = 'delta-trace-equivalence'
    const strategy = vi.fn((graphic, data: RenderElementData) => {
      graphic
        .clear()
        .rect(data.x, data.y, data.width, data.height)
        .fill(0x336699)
    })
    const initialData = {
      id: 'trace-element',
      type: strategyType,
      visible: true,
      name: 'Trace Element',
      lock: false,
      x: 0,
      y: 0,
      width: 20,
      height: 20
    } as unknown as RenderElementData
    const finalData = {
      ...initialData,
      x: 30,
      y: 40,
      width: 80,
      height: 60
    }
    const freshEngine = new RecordingRenderEngine({ name: 'fresh-trace' })
    const freshRender = new Render({ engine: freshEngine })
    const drawOperationsAfter = (
      targetEngine: RecordingRenderEngine,
      startIndex: number
    ) =>
      targetEngine
        .getOperations()
        .slice(startIndex)
        .flatMap((operation) =>
          operation.type === 'draw' ? [operation.command.operations] : []
        )

    renderStrategyRegistry.register(strategyType, strategy)

    try {
      await render.init(100, 100, 0)
      render.addElement(initialData)
      render.flushFrame()
      const deltaStartIndex = engine.getOperations().length

      render.updateElement(
        finalData.id,
        'computed',
        undefined,
        undefined,
        finalData
      )
      render.flushFrame()
      const deltaDrawOperations = drawOperationsAfter(engine, deltaStartIndex)

      await freshRender.init(100, 100, 0)
      const freshStartIndex = freshEngine.getOperations().length
      freshRender.addElement(finalData)
      freshRender.flushFrame()
      const freshDrawOperations = drawOperationsAfter(
        freshEngine,
        freshStartIndex
      )

      expect(deltaDrawOperations).toEqual(freshDrawOperations)
      expect(deltaDrawOperations).toHaveLength(1)
    } finally {
      renderStrategyRegistry.unregister(strategyType)
    }
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
