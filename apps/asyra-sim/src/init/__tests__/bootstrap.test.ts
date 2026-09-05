// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { bootstrap } from '../bootstrap'
import { VisualAssetArchive } from '../../storage/visual-archive'
import { decodeRestrictedGlb } from '../../engine/glb/decode'
import { ThreeEngine, type GraphicsDriver } from '../../engine/three-engine'
import {
  createWorkcellFrame,
  DEFAULT_CAMERA
} from '../../render-app/workcell-frame'

it('composes the normal workcell runtime and cleans up surface subscriptions and resources', async () => {
  const host = document.createElement('div')
  host.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 640,
    height: 480,
    left: 0,
    top: 0,
    right: 640,
    bottom: 480,
    toJSON: () => ({})
  })
  const canvas = document.createElement('canvas')
  const driver: GraphicsDriver = {
    domElement: canvas,
    autoClear: true,
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    clear: vi.fn(),
    clearDepth: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn()
  }
  let onResize: ResizeObserverCallback | undefined,
    frame: FrameRequestCallback | undefined
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        onResize = callback
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = disconnect
    }
  )
  const runtime = await bootstrap(
    host,
    () =>
      new ThreeEngine({
        createDriver: () => driver,
        requestFrame: (callback) => {
          frame = callback
          return 1
        },
        cancelFrame: () => {
          frame = undefined
        }
      }),
    undefined,
    new VisualAssetArchive({ decode: decodeRestrictedGlb, dispose: vi.fn() })
  )
  const candidate = runtime.getCandidates()[0],
    model = runtime.getWorkcell(candidate.id)
  expect(candidate.name).toBe('A - Baseline workcell')
  expect(model.bodies.every((body) => body.visuals?.length === 1)).toBe(true)
  expect(runtime.getVisualAssets(model).size).toBe(11)
  expect((await runtime.captureSnapshot()).visualSources).toHaveLength(11)
  expect(
    model.bodies.filter((body) => body.joint.kind === 'revolute')
  ).toHaveLength(6)
  const experiments = runtime.getExperiments(candidate.id)
  expect(experiments).toHaveLength(1)
  const experiment = experiments[0]
  if (!experiment) throw new Error('Expected synthetic experiment')
  expect(experiment.definition.trajectory.keyframes).toHaveLength(3)
  const preflight = runtime.preflightExperiment(experiment.id)
  expect(preflight.blockers).toEqual([])
  expect(preflight.pairs.length).toBeGreaterThan(0)
  const snapshot = runtime.createExperimentSnapshot(experiment.id, [])
  expect(snapshot.source).toMatchObject({
    candidateId: candidate.id,
    experimentId: experiment.id,
    experimentRevision: 1
  })
  expect(Object.isFrozen(snapshot)).toBe(true)
  runtime.setFrame(
    createWorkcellFrame(
      model,
      {
        camera: DEFAULT_CAMERA,
        selectedId: null,
        grid: true
      },
      runtime.getVisualAssets(model)
    )
  )
  frame?.(1)
  const depth = runtime.getHistoryDepth()
  onResize?.(
    [{ contentRect: { width: 800, height: 600 } }] as ResizeObserverEntry[],
    {} as ResizeObserver
  )
  expect(driver.setSize).toHaveBeenLastCalledWith(800, 600)
  expect(runtime.getHistoryDepth()).toBe(depth)
  canvas.getBoundingClientRect = () => ({
    x: 300,
    y: 150,
    left: 300,
    top: 150,
    right: 700,
    bottom: 450,
    width: 400,
    height: 300,
    toJSON: () => ({})
  })
  runtime.setFrame({
    camera: {
      kind: 'camera',
      position: [0, 0, 5],
      target: [0, 0, 0],
      fov: 60,
      near: 0.01,
      far: 100
    },
    meshes: [
      {
        id: 'surface-proof',
        elementId: model.bodies[0].id,
        visible: true,
        descriptor: {
          kind: 'mesh',
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          shape: { kind: 'box', size: [1, 1, 1] },
          color: 0xffffff,
          opacity: 1,
          wireframe: false,
          selectable: true
        }
      }
    ]
  })
  frame?.(2)
  expect(runtime.pick(500, 300)).toBe(model.bodies[0].id)
  expect(runtime.pick(250, 300)).toBeNull()
  const listener = vi.fn(),
    unsubscribe = runtime.subscribe(listener)
  await runtime.features.edit.upsert(candidate.id, {
    ...model.bodies[0],
    name: 'Changed base'
  })
  expect(listener).toHaveBeenCalledOnce()
  unsubscribe()
  await runtime.dispose()
  await runtime.dispose()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(driver.dispose).toHaveBeenCalledOnce()
  expect(host.childElementCount).toBe(0)
  vi.unstubAllGlobals()
})
