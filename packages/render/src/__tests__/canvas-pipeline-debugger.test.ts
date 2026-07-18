import { describe, expect, it, vi } from 'vitest'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import { Render } from '../render'
import {
  createCanvasPipelineDebuggerAdapter,
  createCanvasPipelineDebuggerOverlay,
  type CanvasPipelineDebuggerAdapter
} from '../canvas-pipeline-debugger'
import { RenderContainer, RenderGraphics } from '../types/render-object'
import { isCanvasPipelineDebuggerOwned } from '../diagnostics/canvas-pipeline'

const createAdapter = (
  name: string,
  options?: Parameters<typeof createCanvasPipelineDebuggerAdapter>[1]
): { render: Render; adapter: CanvasPipelineDebuggerAdapter } => {
  const render = new Render({
    engine: new RecordingRenderEngine({ name })
  })
  return {
    render,
    adapter: createCanvasPipelineDebuggerAdapter(render, options)
  }
}

describe('CanvasPipelineDebuggerAdapter trace projection', () => {
  it('stays inactive until observation is enabled', () => {
    const { render, adapter } = createAdapter('disabled-debugger')

    render.panTo(1, 2)
    expect(adapter.getTrace()).toEqual([])

    adapter.enableObservation()
    render.panTo(3, 4)
    adapter.disableObservation()
    render.zoomTo(2)

    expect(adapter.getTrace()).toHaveLength(1)
    expect(adapter.getTrace()[0]).toMatchObject({
      sequence: 1,
      kind: 'viewport-input',
      operation: 'pan'
    })
  })

  it('retains a reported session fault until observation is re-enabled', () => {
    const { adapter } = createAdapter('reported-session-fault')

    adapter.reportFault(new Error('overlay projection failed'))

    expect(adapter.getSnapshot().fault).toEqual({
      message: 'overlay projection failed'
    })

    adapter.enableObservation()

    expect(adapter.getSnapshot().fault).toBeNull()
  })

  it('uses a deterministic bounded trace and reports dropped entries', () => {
    const { render, adapter } = createAdapter('bounded-debugger', {
      traceCapacity: 2
    })
    adapter.enableObservation()

    render.panTo(1, 2)
    render.zoomTo(2)
    render.panTo(3, 4)

    expect(adapter.getTrace().map((entry) => entry.sequence)).toEqual([2, 3])
    expect(adapter.getSnapshot()).toMatchObject({
      sequence: 3,
      droppedEntryCount: 1
    })

    adapter.clearTrace()

    expect(adapter.getTrace()).toEqual([])
    expect(adapter.getSnapshot()).toMatchObject({
      sequence: 3,
      droppedEntryCount: 0
    })
  })

  it('preserves live focused state when its attach evidence leaves the bounded trace', async () => {
    const { render, adapter } = createAdapter('bounded-focused-state', {
      traceCapacity: 2,
      focusedElementIds: ['focused-element']
    })
    adapter.enableObservation()
    await render.init(100, 100, 0)
    render.addElement({
      id: 'focused-element',
      type: 'rectangle',
      visible: true,
      name: 'Focused',
      lock: false,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0
    } as never)

    expect(adapter.getSnapshot().focusedElements[0]?.status).toBe('observed')

    render.panTo(1, 2)
    render.panTo(3, 4)
    render.panTo(5, 6)
    adapter.setFocusedElementIds(['focused-element'])

    expect(adapter.getSnapshot().focusedElements[0]?.status).toBe('observed')
  })

  it('projects only observed focused geometry through the canonical viewport', async () => {
    const { render, adapter } = createAdapter('focused-debugger')
    adapter.setFocusedElementIds([
      'focused-element',
      'missing-element',
      'focused-element'
    ])
    adapter.enableObservation()

    await render.init(320, 240, 0)
    render.addElement({
      id: 'focused-element',
      type: 'rectangle',
      visible: true,
      name: 'Focused',
      lock: false,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0
    } as never)
    render.panTo(5, 7)
    render.zoomTo(2)
    render.flushFrame()

    const snapshot = adapter.getSnapshot()

    expect(snapshot.focusedElements.map((item) => item.elementId)).toEqual([
      'focused-element',
      'missing-element'
    ])
    expect(snapshot.focusedElements[0]).toMatchObject({
      status: 'observed',
      projection: {
        localBounds: { x: 0, y: 0, width: 30, height: 40 },
        canvasCorners: [
          { x: 25, y: 47 },
          { x: 85, y: 47 },
          { x: 85, y: 127 },
          { x: 25, y: 127 }
        ],
        workspaceCorners: [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
          { x: 40, y: 60 },
          { x: 10, y: 60 }
        ]
      }
    })
    expect(snapshot.focusedElements[1]).toEqual({
      elementId: 'missing-element',
      status: 'not-observed'
    })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.focusedElements)).toBe(true)
  })

  it('keeps detailed handoff payload only for focused elements', async () => {
    const { render, adapter } = createAdapter('focused-handoff-detail')
    adapter.setFocusedElementIds(['focused-element'])
    adapter.enableObservation()

    await render.init(320, 240, 0)
    const rectangle = (id: string, x: number) => ({
      id,
      type: 'rectangle',
      visible: true,
      name: id,
      lock: false,
      x,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0
    })
    render.addElement(rectangle('focused-element', 10) as never)
    render.addElement(rectangle('other-element', 60) as never)
    render.flushFrame()

    const handoffs = adapter
      .getTrace()
      .filter((entry) => entry.kind === 'engine-handoff')
    const focused = handoffs.find(
      (entry) => entry.command.elementId === 'focused-element'
    )
    const other = handoffs.find(
      (entry) => entry.command.elementId === 'other-element'
    )

    expect(focused?.command).toEqual(
      expect.objectContaining({
        data: expect.anything(),
        projection: expect.anything()
      })
    )
    expect(other?.command).not.toHaveProperty('data')
    expect(other?.command).not.toHaveProperty('projection')
  })

  it('reports only layers evaluated in the current frame', async () => {
    const { render, adapter } = createAdapter('current-frame-layers')
    adapter.enableObservation()
    await render.init(100, 100, 0)
    render.registerLayer({
      name: 'earlier-layer',
      layer: {},
      zIndex: 10,
      update: () => false
    })
    render.registerLayer({
      name: 'later-layer',
      layer: {},
      zIndex: 20,
      update: () => false
    })

    render.flushFrame()
    expect(adapter.getSnapshot().layers.map((layer) => layer.name)).toEqual([
      'earlier-layer',
      'later-layer'
    ])

    render.unregisterLayer('earlier-layer')
    render.flushFrame()

    expect(adapter.getSnapshot().layers.map((layer) => layer.name)).toEqual([
      'later-layer'
    ])
  })

  it('preserves canonical evaluation order for layers with the same z-index', async () => {
    const { render, adapter } = createAdapter('same-z-index-layers')
    adapter.enableObservation()
    await render.init(100, 100, 0)
    render.registerLayer({
      name: 'registered-first',
      layer: {},
      zIndex: 10,
      update: () => false
    })
    render.registerLayer({
      name: 'alphabetically-first',
      layer: {},
      zIndex: 10,
      update: () => false
    })

    render.flushFrame()

    expect(adapter.getSnapshot().layers.map((layer) => layer.name)).toEqual([
      'registered-first',
      'alphabetically-first'
    ])
  })

  it('keeps a removed focused element not-observed after teardown handoffs', async () => {
    const { render, adapter } = createAdapter('removed-focused-element')
    adapter.setFocusedElementIds(['focused-element'])
    adapter.enableObservation()
    await render.init(100, 100, 0)
    render.addElement({
      id: 'focused-element',
      type: 'rectangle',
      visible: true,
      name: 'Focused',
      lock: false,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0
    } as never)

    expect(adapter.getSnapshot().focusedElements[0]?.status).toBe('observed')

    render.removeElement('focused-element')

    expect(adapter.getSnapshot().focusedElements[0]).toEqual({
      elementId: 'focused-element',
      status: 'not-observed'
    })

    render.flushFrame()

    expect(adapter.getSnapshot().focusedElements[0]).toEqual({
      elementId: 'focused-element',
      status: 'not-observed'
    })
  })

  it('does not treat an unfulfilled remove input as a completed handoff', async () => {
    const { render, adapter } = createAdapter('unfulfilled-remove-input')
    adapter.setFocusedElementIds(['focused-element'])
    adapter.enableObservation()
    await render.init(100, 100, 0)
    render.addElement({
      id: 'focused-element',
      type: 'rectangle',
      visible: true,
      name: 'Focused',
      lock: false,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0
    } as never)
    render.viewport.removeElement = vi.fn(() => undefined)

    render.removeElement('focused-element')

    expect(adapter.getTrace()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'element-input',
          operation: 'remove',
          elementId: 'focused-element'
        })
      ])
    )
    expect(adapter.getSnapshot().focusedElements[0]).toMatchObject({
      elementId: 'focused-element',
      status: 'observed'
    })
  })

  it('waits for an append handoff before reporting a focused object as attached', async () => {
    const engine = new RecordingRenderEngine({ name: 'focused-attach-state' })
    const render = new Render({ engine })
    const adapter = createCanvasPipelineDebuggerAdapter(render, {
      focusedElementIds: ['focused-element']
    })
    adapter.enableObservation()
    await render.init(100, 100, 0)
    const execute = engine.execute.bind(engine)
    let sawFocusedCreate = false
    engine.execute = vi.fn((command) => {
      if (
        command.type === 'create-object' &&
        command.requestId === 'focused-element'
      ) {
        sawFocusedCreate = true
        expect(adapter.getSnapshot().focusedElements[0]?.status).toBe(
          'not-observed'
        )
      } else if (sawFocusedCreate && command.type === 'append-child') {
        expect(adapter.getSnapshot().focusedElements[0]?.status).toBe(
          'observed'
        )
      }
      return execute(command)
    })

    render.addElement({
      id: 'focused-element',
      type: 'rectangle',
      visible: true,
      name: 'Focused',
      lock: false,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0
    } as never)

    expect(sawFocusedCreate).toBe(true)
  })

  it('keeps a focused element observed when canonical reparenting detaches it temporarily', async () => {
    const { render, adapter } = createAdapter('reparented-focused-element')
    adapter.setFocusedElementIds(['focused-element'])
    adapter.enableObservation()
    await render.init(100, 100, 0)
    render.addContainer({
      label: 'target-container',
      x: 0,
      y: 0
    } as never)
    render.addElement({
      id: 'focused-element',
      type: 'rectangle',
      visible: true,
      name: 'Focused',
      lock: false,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0
    } as never)

    render.updateElement(
      'target-container',
      'children',
      [],
      ['focused-element']
    )

    expect(adapter.getSnapshot().focusedElements[0]).toMatchObject({
      elementId: 'focused-element',
      status: 'observed',
      projection: {
        localBounds: { x: 0, y: 0, width: 30, height: 40 }
      }
    })
  })

  it('reprojects focused geometry from observed viewport handoffs', async () => {
    const { render, adapter } = createAdapter('viewport-reprojection')
    adapter.setFocusedElementIds(['focused-element'])
    adapter.enableObservation()
    await render.init(320, 240, 0)
    render.addElement({
      id: 'focused-element',
      type: 'rectangle',
      visible: true,
      name: 'Focused',
      lock: false,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0
    } as never)
    render.flushFrame()

    render.panTo(15, 17)
    render.zoomTo(3)

    expect(adapter.getSnapshot().focusedElements[0]).toMatchObject({
      status: 'observed',
      projection: {
        canvasCorners: [
          { x: 45, y: 77 },
          { x: 135, y: 77 },
          { x: 135, y: 197 },
          { x: 45, y: 197 }
        ],
        workspaceCorners: [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
          { x: 40, y: 60 },
          { x: 10, y: 60 }
        ]
      }
    })
  })

  it('projects focused rotation from canonical Render transforms', async () => {
    const { render, adapter } = createAdapter('rotation-projection')
    adapter.setFocusedElementIds(['focused-element'])
    adapter.enableObservation()
    await render.init(320, 240, 0)
    const element = render.addElement({
      id: 'focused-element',
      type: 'rectangle',
      visible: true,
      name: 'Focused',
      lock: false,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0
    } as never)
    if (!element) {
      throw new Error('Expected focused element to be created')
    }
    render.updateElementProperties(element, 'rotation', Math.PI / 2)
    render.flushFrame()

    const focused = adapter.getSnapshot().focusedElements[0]
    if (focused?.status !== 'observed' || !focused.projection) {
      throw new Error('Expected observed rotation projection')
    }
    const expectedCorners = [
      { x: 10, y: 20 },
      { x: 10, y: 50 },
      { x: -30, y: 50 },
      { x: -30, y: 20 }
    ]
    focused.projection.canvasCorners.forEach((point, index) => {
      expect(point.x).toBeCloseTo(expectedCorners[index].x)
      expect(point.y).toBeCloseTo(expectedCorners[index].y)
    })
  })

  it('disposes observation and rejects later operations', () => {
    const { render, adapter } = createAdapter('disposed-debugger')
    adapter.enableObservation()
    render.panTo(1, 1)

    adapter.dispose()
    adapter.dispose()

    expect(() => adapter.getTrace()).toThrow(
      expect.objectContaining({ code: 'CANVAS_PIPELINE_DEBUGGER_DISPOSED' })
    )
    expect(() => adapter.enableObservation()).toThrow(
      expect.objectContaining({ code: 'CANVAS_PIPELINE_DEBUGGER_DISPOSED' })
    )
  })
})

describe('Canvas Pipeline Debugger overlay', () => {
  it('claims every debugger-created Render object by identity', () => {
    const { adapter } = createAdapter('identity-owned-overlay')
    const overlay = createCanvasPipelineDebuggerOverlay(adapter)
    const root = overlay.registration.layer as RenderContainer
    const graphics = root.children[0] as RenderGraphics

    expect(isCanvasPipelineDebuggerOwned(root)).toBe(true)
    expect(isCanvasPipelineDebuggerOwned(graphics)).toBe(true)

    overlay.destroy()

    expect(isCanvasPipelineDebuggerOwned(root)).toBe(true)
    expect(isCanvasPipelineDebuggerOwned(graphics)).toBe(true)
  })

  it('draws only observed expected geometry with engine-neutral graphics', async () => {
    const { render, adapter } = createAdapter('debugger-overlay')
    adapter.setFocusedElementIds(['focused-element', 'missing-element'])
    adapter.enableObservation()
    await render.init(320, 240, 0)
    render.addElement({
      id: 'focused-element',
      type: 'rectangle',
      visible: true,
      name: 'Focused',
      lock: false,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0
    } as never)
    render.panTo(5, 7)
    render.zoomTo(2)
    render.flushFrame()

    const overlay = createCanvasPipelineDebuggerOverlay(adapter)
    const root = overlay.registration.layer as RenderContainer
    const graphics = root.children[0] as RenderGraphics

    expect(root.eventMode).toBe('none')
    expect(graphics.eventMode).toBe('none')
    expect(overlay.registration.shouldUpdate?.()).toBe(true)
    expect(overlay.registration.update?.()).toBe(true)
    expect(graphics.getDrawOperations()).toEqual([
      { type: 'clear' },
      { type: 'move-to', x: 25, y: 47 },
      { type: 'line-to', x: 85, y: 47 },
      { type: 'line-to', x: 85, y: 127 },
      { type: 'line-to', x: 25, y: 127 },
      { type: 'close-path' },
      {
        type: 'stroke',
        paint: { color: '#59b7ff', alpha: 1 },
        width: 1
      }
    ])
  })

  it('excludes its layer and commands from product pipeline evidence', async () => {
    const { render, adapter } = createAdapter('self-excluded-overlay')
    adapter.enableObservation()
    await render.init(100, 100, 0)
    const overlay = createCanvasPipelineDebuggerOverlay(adapter)

    render.registerLayer(overlay.registration)
    render.flushFrame()

    const trace = adapter.getTrace()
    expect(
      trace.some(
        (entry) =>
          entry.kind === 'layer-evaluation' &&
          entry.layerName === overlay.registration.name
      )
    ).toBe(false)
    expect(
      trace.some(
        (entry) =>
          entry.kind === 'engine-handoff' &&
          entry.command.elementId?.startsWith('canvas-pipeline-debugger')
      )
    ).toBe(false)

    render.unregisterLayer(overlay.registration.name)
    overlay.destroy()

    expect(
      adapter
        .getTrace()
        .some(
          (entry) =>
            entry.kind === 'engine-handoff' &&
            entry.command.elementId?.startsWith('canvas-pipeline-debugger')
        )
    ).toBe(false)
  })

  it('unregisters, destroys, and recreates debugger-owned runtime objects', async () => {
    const engine = new RecordingRenderEngine({ name: 'overlay-cleanup' })
    const render = new Render({ engine })
    const adapter = createCanvasPipelineDebuggerAdapter(render)
    await render.init(100, 100, 0)
    const overlay = createCanvasPipelineDebuggerOverlay(adapter)

    render.registerLayer(overlay.registration)
    const countWithOverlay = engine.getOwnedObjectCount()
    expect(render.unregisterLayer(overlay.registration.name)).toBe(true)
    overlay.destroy()
    overlay.destroy()

    expect(engine.getOwnedObjectCount()).toBeLessThan(countWithOverlay)

    const recreated = createCanvasPipelineDebuggerOverlay(adapter)
    expect(() => render.registerLayer(recreated.registration)).not.toThrow()
    render.unregisterLayer(recreated.registration.name)
    recreated.destroy()
  })

  it('contains overlay projection faults without drawing fallback geometry', () => {
    const onFault = vi.fn()
    const overlay = createCanvasPipelineDebuggerOverlay(
      {
        isObserving: () => true,
        getSnapshot: () => {
          throw new Error('overlay projection failed')
        }
      } as CanvasPipelineDebuggerAdapter,
      { onFault }
    )
    const root = overlay.registration.layer as RenderContainer
    const graphics = root.children[0] as RenderGraphics
    let updateResult: boolean | undefined

    expect(() => {
      updateResult = overlay.registration.update?.()
    }).not.toThrow()
    expect(updateResult).toBe(false)
    expect(onFault).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'overlay projection failed' })
    )
    expect(graphics.getDrawOperations()).toEqual([])

    overlay.destroy()
  })
})
