import { describe, expect, it, vi } from 'vitest'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import { Render } from '../render'
import {
  markCanvasPipelineDebuggerOwned,
  publishCanvasPipelineEvidence,
  subscribeToCanvasPipelineEvidence,
  type CanvasPipelineEvidence
} from '../diagnostics/canvas-pipeline'
import { RenderContainer } from '../types/render-object'

const createRender = (name: string) =>
  new Render({ engine: new RecordingRenderEngine({ name }) })

describe('Canvas pipeline diagnostics', () => {
  it('does not evaluate a diagnostic payload factory without subscribers', () => {
    const owner = {}
    const createEvidence = vi.fn<() => CanvasPipelineEvidence>(() => ({
      kind: 'viewport-input',
      frameId: 0,
      operation: 'pan',
      data: { x: 1, y: 2 }
    }))

    publishCanvasPipelineEvidence(owner, createEvidence)

    expect(createEvidence).not.toHaveBeenCalled()
  })

  it('publishes every engine handoff before executing the same command', async () => {
    const engine = new RecordingRenderEngine({ name: 'pre-engine-evidence' })
    const render = new Render({ engine })
    await render.init(100, 100, 0)

    const evidenceCountByType = new Map<string, number>()
    const engineCountByType = new Map<string, number>()
    subscribeToCanvasPipelineEvidence(render, {
      onEvidence: (entry) => {
        if (entry.kind === 'engine-handoff') {
          evidenceCountByType.set(
            entry.command.type,
            (evidenceCountByType.get(entry.command.type) ?? 0) + 1
          )
        }
      }
    })
    const execute = engine.execute.bind(engine)
    engine.execute = vi.fn((command) => {
      const engineCount = engineCountByType.get(command.type) ?? 0
      expect(evidenceCountByType.get(command.type) ?? 0).toBeGreaterThan(
        engineCount
      )
      engineCountByType.set(command.type, engineCount + 1)
      return execute(command)
    })

    render.addElement({
      id: 'ordered-element',
      type: 'rectangle',
      visible: true,
      name: 'Ordered',
      lock: false,
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      rotation: 0
    } as never)
    render.resize(120, 80)
    render.flushFrame()

    expect(engine.execute).toHaveBeenCalled()
  })

  it('emits detached canonical evidence without engine handles or results', async () => {
    const render = createRender('pipeline-evidence')
    const evidence: CanvasPipelineEvidence[] = []
    const unsubscribe = subscribeToCanvasPipelineEvidence(render, {
      onEvidence: (entry) => evidence.push(entry)
    })
    const elementData = {
      id: 'focused-element',
      type: 'rectangle',
      visible: true,
      name: 'Focused',
      lock: false,
      x: 12,
      y: 16,
      width: 24,
      height: 28,
      rotation: 0
    }

    await render.init(320, 240, 0)
    render.addElement(elementData as never)
    elementData.width = 999
    render.panTo(10, 20)
    render.zoomTo(2)
    render.registerLayer({
      name: 'bypassed-layer',
      layer: {},
      zIndex: 9,
      shouldUpdate: () => false,
      update: vi.fn(() => true)
    })
    render.flushFrame()
    unsubscribe()

    expect(evidence.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining([
        'element-input',
        'viewport-input',
        'layer-evaluation',
        'engine-handoff',
        'frame'
      ])
    )
    expect(
      evidence.find(
        (entry) =>
          entry.kind === 'element-input' &&
          entry.elementId === 'focused-element'
      )
    ).toMatchObject({
      operation: 'add',
      data: { width: 24 }
    })
    expect(
      evidence.find(
        (entry) =>
          entry.kind === 'layer-evaluation' &&
          entry.layerName === 'bypassed-layer'
      )
    ).toMatchObject({ zIndex: 9, outcome: 'bypassed' })
    expect(
      evidence.find(
        (entry) =>
          entry.kind === 'engine-handoff' &&
          entry.command.type === 'draw' &&
          entry.command.elementId === 'focused-element'
      )
    ).toMatchObject({
      command: {
        projection: {
          localBounds: { x: 0, y: 0, width: 24, height: 28 },
          worldTransform: { tx: 34, ty: 52 },
          viewportTransform: { tx: 10, ty: 20 }
        }
      }
    })
    expect(evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'engine-handoff',
          command: expect.objectContaining({ renderRole: 'viewport' })
        })
      ])
    )
    expect(JSON.stringify(evidence)).not.toContain('commandType')
    expect(JSON.stringify(evidence)).not.toContain('pipeline-evidence:')
    expect(JSON.stringify(evidence)).not.toContain('hit-test')
  })

  it('isolates evidence subscriptions by Render instance', async () => {
    const first = createRender('first-diagnostics')
    const second = createRender('second-diagnostics')
    const firstEvidence: CanvasPipelineEvidence[] = []
    const secondEvidence: CanvasPipelineEvidence[] = []

    subscribeToCanvasPipelineEvidence(first, {
      onEvidence: (entry) => firstEvidence.push(entry)
    })
    subscribeToCanvasPipelineEvidence(second, {
      onEvidence: (entry) => secondEvidence.push(entry)
    })

    await first.init(100, 100, 0)

    expect(firstEvidence.length).toBeGreaterThan(0)
    expect(secondEvidence).toEqual([])
  })

  it('excludes pipeline evidence only for explicitly owned diagnostic objects', async () => {
    const render = createRender('identity-owned-diagnostics')
    const evidence: CanvasPipelineEvidence[] = []
    await render.init(100, 100, 0)
    subscribeToCanvasPipelineEvidence(render, {
      onEvidence: (entry) => evidence.push(entry)
    })
    const ownedLayer = new RenderContainer({ label: 'identity-owned-layer' })
    markCanvasPipelineDebuggerOwned(ownedLayer)

    render.registerLayer({
      name: 'identity-owned-layer',
      layer: ownedLayer,
      update: () => true
    })
    render.flushFrame()
    render.unregisterLayer('identity-owned-layer')
    ownedLayer.destroy({ children: true })

    expect(
      evidence.some(
        (entry) =>
          entry.kind === 'layer-evaluation' &&
          entry.layerName === 'identity-owned-layer'
      )
    ).toBe(false)
    expect(
      evidence.some(
        (entry) =>
          entry.kind === 'engine-handoff' &&
          entry.command.elementId === 'identity-owned-layer'
      )
    ).toBe(false)
  })

  it('does not let product objects claim diagnostic exclusion through a public string', async () => {
    const render = createRender('unforgeable-diagnostic-ownership')
    const evidence: CanvasPipelineEvidence[] = []
    await render.init(100, 100, 0)
    subscribeToCanvasPipelineEvidence(render, {
      onEvidence: (entry) => evidence.push(entry)
    })
    const productLayer = new RenderContainer({
      label: 'canvas-pipeline-debugger:product-layer'
    })
    const legacySetter = Reflect.get(
      productLayer,
      'setCanvasPipelineDiagnosticSource'
    )
    if (typeof legacySetter === 'function') {
      legacySetter.call(productLayer, 'canvas-pipeline-debugger')
    }

    render.registerLayer({
      name: 'product-layer-with-debug-label',
      layer: productLayer,
      update: () => true
    })
    render.flushFrame()

    expect('setCanvasPipelineDiagnosticSource' in productLayer).toBe(false)
    expect('getCanvasPipelineDiagnosticSource' in productLayer).toBe(false)
    expect(
      evidence.some(
        (entry) =>
          entry.kind === 'layer-evaluation' &&
          entry.layerName === 'product-layer-with-debug-label'
      )
    ).toBe(true)
    expect(
      evidence.some(
        (entry) =>
          entry.kind === 'engine-handoff' &&
          entry.command.elementId === 'canvas-pipeline-debugger:product-layer'
      )
    ).toBe(true)

    render.unregisterLayer('product-layer-with-debug-label')
    productLayer.destroy({ children: true })
  })

  it('contains subscriber failure without interrupting canonical rendering', async () => {
    const render = createRender('subscriber-failure')
    const onEvidence = vi.fn(() => {
      throw new Error('diagnostic subscriber failed')
    })
    const onError = vi.fn()

    await render.init(100, 100, 0)
    subscribeToCanvasPipelineEvidence(render, { onEvidence, onError })

    expect(() => render.panTo(5, 6)).not.toThrow()
    expect(onEvidence).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'diagnostic subscriber failed' })
    )

    render.zoomTo(2)

    expect(onEvidence).toHaveBeenCalledTimes(1)
  })

  it('contains evidence normalization failure without interrupting canonical rendering', async () => {
    const render = createRender('normalization-failure')
    const onEvidence = vi.fn()
    const onError = vi.fn()

    await render.init(100, 100, 0)
    subscribeToCanvasPipelineEvidence(render, { onEvidence, onError })

    const containerData = {
      label: 'canonical-container',
      x: 0,
      y: 0,
      get diagnosticOnly() {
        throw new Error('diagnostic normalization failed')
      }
    }

    expect(() => render.addContainer(containerData)).not.toThrow()
    expect(render.viewport.getElementById('canonical-container')).toBeDefined()
    expect(onEvidence).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'diagnostic normalization failed' })
    )

    render.panTo(5, 6)

    expect(onEvidence).not.toHaveBeenCalled()
  })
})
