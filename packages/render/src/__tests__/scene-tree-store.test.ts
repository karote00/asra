import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EntityTypes } from '@asyra/utils'

let pendingRenderLayer: {
  shouldUpdate?: () => boolean
  update?: () => boolean | undefined
} | null = null
let pendingRenderTeardownCleanup: (() => void) | null = null

const renderMock = {
  switchWorkspace: vi.fn(),
  addElement: vi.fn(),
  removeElement: vi.fn(),
  updateElement: vi.fn(),
  getElementById: vi.fn(() => ({})),
  clearElements: vi.fn(),
  flushFrame: vi.fn(),
  requestRender: vi.fn(),
  registerTeardownCleanup: vi.fn((cleanup: () => void) => {
    pendingRenderTeardownCleanup = cleanup
    return () => {
      if (pendingRenderTeardownCleanup === cleanup) {
        pendingRenderTeardownCleanup = null
      }
    }
  }),
  registerLayer: vi.fn(
    (registration: {
      shouldUpdate?: () => boolean
      update?: () => boolean | undefined
    }) => {
      pendingRenderLayer = registration
    }
  )
}

const sceneTreeMock = {
  currentWorkspace: null as null | { save: () => Record<string, unknown> },
  getAllElements: vi.fn(),
  getElementById: vi.fn()
}

vi.mock('../render', () => ({
  default: renderMock
}))

vi.mock('@asyra/scene-tree', () => ({
  default: sceneTreeMock
}))

const createElement = (
  id: string,
  raw: Record<string, unknown>,
  computed: Record<string, unknown>
) => ({
  get: vi.fn((key: string) => {
    if (key === 'id') {
      return id
    }
    if (key === 'type') {
      return raw.type
    }
    return raw[key]
  }),
  save: vi.fn(() => ({ ...raw, id })),
  getAllComputedData: vi.fn(() => ({ ...computed }))
})

const seedStore = (
  store: { addElementById: (elementId: string) => void },
  elementId: string
) => {
  store.addElementById(elementId)
  const snapshot = renderMock.addElement.mock.calls.at(-1)?.[0] as
    | Record<string, unknown>
    | undefined
  renderMock.addElement.mockClear()
  return snapshot
}

describe('RenderSceneTree computed data mirror', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    renderMock.getElementById.mockReturnValue({})
    sceneTreeMock.currentWorkspace = null
    sceneTreeMock.getAllElements.mockReturnValue(new Map())
    sceneTreeMock.getElementById.mockReset()
  })

  const flushScheduledFrame = async () => {
    if (pendingRenderLayer?.shouldUpdate?.()) {
      pendingRenderLayer.update?.()
      return
    }
    await Promise.resolve()
  }

  it('should run: clear stale render elements before rebuilding a scene-tree reload', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const vector = createElement(
      'vector-1',
      {
        type: 'vector',
        visible: true,
        name: 'Vector'
      },
      {
        points: { p1: { x: 0, y: 0 } },
        segments: {},
        networks: {}
      }
    )
    sceneTreeMock.currentWorkspace = {
      save: () => ({
        id: 'workspace-1',
        type: EntityTypes.WORKSPACE
      })
    }
    sceneTreeMock.getAllElements.mockReturnValue(
      new Map([['vector-1', vector]])
    )
    sceneTreeMock.getElementById.mockReturnValue(vector)

    store.reload()

    expect(renderMock.clearElements).toHaveBeenCalledTimes(1)
    expect(renderMock.switchWorkspace).toHaveBeenCalledWith({
      label: 'workspace-1',
      x: 0,
      y: 0
    })
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vector-1',
        type: 'vector',
        points: { p1: { x: 0, y: 0 } }
      })
    )
  })

  it('should run: discard a reload snapshot when visual add fails', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const first = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    const second = createElement(
      'vector-2',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.currentWorkspace = {
      save: () => ({ id: 'workspace-1', type: EntityTypes.WORKSPACE })
    }
    sceneTreeMock.getAllElements.mockReturnValue(
      new Map([
        ['vector-1', first],
        ['vector-2', second]
      ])
    )
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elementId === 'vector-1' ? first : second
    )
    renderMock.addElement.mockImplementationOnce(() => {
      throw new Error('visual add failed')
    })

    expect(() => store.reload()).not.toThrow()

    expect(renderMock.addElement).toHaveBeenCalledTimes(2)
    expect(store.getProjectionSnapshotCount()).toBe(1)
  })

  it('should run: exclude workspace elements from reload snapshots', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const workspace = createElement(
      'workspace-1',
      { type: EntityTypes.WORKSPACE },
      {}
    )
    const vector = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {}, segments: {}, networks: {} }
    )
    sceneTreeMock.currentWorkspace = {
      save: () => ({ id: 'workspace-1', type: EntityTypes.WORKSPACE })
    }
    sceneTreeMock.getAllElements.mockReturnValue(
      new Map([
        ['workspace-1', workspace],
        ['vector-1', vector]
      ])
    )
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elementId === 'workspace-1' ? workspace : vector
    )

    store.reload()

    expect(workspace.save).not.toHaveBeenCalled()
    expect(workspace.getAllComputedData).not.toHaveBeenCalled()
    expect(vector.save).toHaveBeenCalledTimes(1)
    expect(vector.getAllComputedData).toHaveBeenCalledTimes(1)
  })

  it('should run: fail closed for invalid explicit add snapshots', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const cases = [
      {
        elementId: 'vector-1',
        element: {
          get: vi.fn((key: string) =>
            key === 'id' ? 'vector-1' : key === 'type' ? 'vector' : undefined
          ),
          save: vi.fn(() => ({ id: 'other-vector', type: 'vector' })),
          getAllComputedData: vi.fn(() => ({ points: {} }))
        }
      },
      {
        elementId: 'workspace-1',
        element: createElement(
          'workspace-1',
          { type: EntityTypes.WORKSPACE },
          {}
        )
      }
    ]

    for (const { elementId, element } of cases) {
      renderMock.addElement.mockClear()
      renderMock.removeElement.mockClear()
      sceneTreeMock.getElementById.mockReturnValue(element)
      const store = new RenderSceneTree()

      expect(store.addElementById(elementId)).toEqual({
        status: 'failed',
        elementId
      })
      expect(store.getProjectionSnapshotCount()).toBe(0)
      expect(renderMock.addElement).not.toHaveBeenCalled()
      expect(renderMock.removeElement).toHaveBeenCalledWith(elementId)
    }
  })

  it('should run: return failed when explicit add composition throws', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    sceneTreeMock.getElementById.mockReturnValue({
      save: vi.fn(() => {
        throw new Error('composition failed')
      }),
      getAllComputedData: vi.fn(() => ({ points: {} }))
    })

    expect(store.addElementById('vector-1')).toEqual({
      status: 'failed',
      elementId: 'vector-1'
    })
    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(renderMock.addElement).not.toHaveBeenCalled()
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
  })

  it('should run: remove stale output and pending work for a missing explicit add target', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    store.updateElement(
      'vector-1',
      'computed',
      'points',
      {},
      { p1: { x: 1, y: 1 } },
      { undoable: false }
    )
    expect(store.hasPendingChanges()).toBe(true)
    sceneTreeMock.getElementById.mockReturnValue(null)
    renderMock.removeElement.mockClear()

    const outcome = store.addElementById('vector-1')

    expect(outcome).toEqual({ status: 'removed', elementId: 'vector-1' })
    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(store.hasPendingChanges()).toBe(false)
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    await flushScheduledFrame()
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: explicitly resync a missing update base from Scene Tree', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: { p1: { x: 1, y: 1 } } }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)

    const outcome = store.updateElement(
      'vector-1',
      'computed',
      'points',
      {},
      { p1: { x: 1, y: 1 } },
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(element.save).toHaveBeenCalledTimes(1)
    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({ points: { p1: { x: 1, y: 1 } } })
    )
  })

  it('should run: add a missing visual from a successful complete resync', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: { p1: { x: 1, y: 1 } } }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    renderMock.getElementById.mockReturnValue(undefined)

    const outcome = store.updateElement(
      'vector-1',
      'computed',
      'points',
      {},
      { p1: { x: 1, y: 1 } },
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vector-1',
        points: { p1: { x: 1, y: 1 } }
      })
    )
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: reject a scalar before mismatch without mutating the published snapshot', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: { p1: { x: 0, y: 0 } } }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    const publishedSnapshot = seedStore(store, 'vector-1')
    element.getAllComputedData.mockReturnValue({
      points: { p1: { x: 10, y: 12 } }
    })

    const outcome = store.updateElement(
      'vector-1',
      'computed',
      'points',
      { p1: { x: 99, y: 99 } },
      { p1: { x: 10, y: 12 } },
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(publishedSnapshot).toEqual(
      expect.objectContaining({ points: { p1: { x: 0, y: 0 } } })
    )
    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({ points: { p1: { x: 10, y: 12 } } })
    )
  })

  it('should run: reject a scalar without declared owner provenance', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: { p1: { x: 0, y: 0 } } }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    element.getAllComputedData.mockReturnValue({
      points: { p1: { x: 10, y: 12 } }
    })

    const outcome = store.updateElement(
      'vector-1',
      undefined as never,
      'points',
      { p1: { x: 0, y: 0 } },
      { p1: { x: 10, y: 12 } },
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(element.getAllComputedData).toHaveBeenCalledTimes(2)
  })

  it('should run: reject a whole batch when a later before value mismatches', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      {
        points: { p1: { x: 0, y: 0 } },
        segments: {}
      }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    const publishedSnapshot = seedStore(store, 'vector-1')
    element.getAllComputedData.mockReturnValue({
      points: { p1: { x: 10, y: 12 } },
      segments: { s1: { startId: 'p1' } }
    })

    const outcome = store.updateElementBatch(
      'vector-1',
      [
        {
          owner: 'computed',
          key: 'points',
          before: { p1: { x: 0, y: 0 } },
          after: { p1: { x: 10, y: 12 } }
        },
        {
          owner: 'computed',
          key: 'segments',
          before: { missing: true },
          after: { s1: { startId: 'p1' } }
        }
      ],
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(publishedSnapshot).toEqual(
      expect.objectContaining({
        points: { p1: { x: 0, y: 0 } },
        segments: {}
      })
    )
    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        points: { p1: { x: 10, y: 12 } },
        segments: { s1: { startId: 'p1' } }
      })
    )
  })

  it('should run: reject a whole batch when any owner provenance is invalid', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {}, segments: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    const publishedSnapshot = seedStore(store, 'vector-1')
    element.getAllComputedData.mockReturnValue({
      points: { p1: { x: 1, y: 1 } },
      segments: { s1: { startId: 'p1' } }
    })

    const outcome = store.updateElementBatch(
      'vector-1',
      [
        {
          owner: 'computed',
          key: 'points',
          before: {},
          after: { p1: { x: 1, y: 1 } }
        },
        {
          owner: 'legacy' as never,
          key: 'segments',
          before: {},
          after: { s1: { startId: 'p1' } }
        }
      ],
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(publishedSnapshot).toEqual(
      expect.objectContaining({ points: {}, segments: {} })
    )
  })

  it('should run: reject a record patch without an existing record base', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { segments: {}, networks: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    const publishedSnapshot = seedStore(store, 'vector-1')
    element.getAllComputedData.mockReturnValue({
      points: { p1: { id: 'p1', x: 0, y: 0 } },
      segments: {},
      networks: {}
    })

    const outcome = store.updateElementPatch(
      'vector-1',
      {
        records: {
          points: {
            set: {
              p1: { after: { id: 'p1', x: 0, y: 0 } }
            }
          }
        }
      },
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(publishedSnapshot).not.toHaveProperty('points')
    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        points: { p1: { id: 'p1', x: 0, y: 0 } }
      })
    )
  })

  it('should run: remove stale output when a mismatch has no canonical element', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    sceneTreeMock.getElementById.mockReturnValue(null)

    const outcome = store.updateElement(
      'vector-1',
      'computed',
      'points',
      { missing: true },
      { p1: { x: 1, y: 1 } },
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(outcome).toEqual({ status: 'removed', elementId: 'vector-1' })
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: fail closed when authoritative resync composition throws', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    element.getAllComputedData.mockImplementation(() => {
      throw new Error('computed snapshot unavailable')
    })

    const outcome = store.updateElement(
      'vector-1',
      'computed',
      'points',
      { missing: true },
      { p1: { x: 1, y: 1 } },
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(outcome).toEqual({ status: 'failed', elementId: 'vector-1' })
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: fail closed when a scalar candidate changes the element identity', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { id: 'vector-1', points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    element.getAllComputedData.mockReturnValue({
      id: 'other-vector',
      points: {}
    })

    const outcome = store.updateElement(
      'vector-1',
      'computed',
      'id',
      'vector-1',
      'other-vector',
      { undoable: false }
    )

    expect(outcome).toEqual({ status: 'failed', elementId: 'vector-1' })
    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: fail closed when a batch candidate clears the element type', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    element.save.mockReturnValue({
      id: 'vector-1',
      type: '',
      visible: true
    })

    const outcome = store.updateElementBatch(
      'vector-1',
      [
        {
          owner: 'raw',
          key: 'type',
          before: 'vector',
          after: ''
        }
      ],
      { undoable: false }
    )

    expect(outcome).toEqual({ status: 'failed', elementId: 'vector-1' })
    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: fail closed when a patch candidate becomes a workspace', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { type: 'vector', points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    element.getAllComputedData.mockReturnValue({
      type: EntityTypes.WORKSPACE,
      points: {}
    })

    const outcome = store.updateElementPatch(
      'vector-1',
      {
        values: {
          type: {
            before: 'vector',
            after: EntityTypes.WORKSPACE
          }
        }
      },
      { undoable: false }
    )

    expect(outcome).toEqual({ status: 'failed', elementId: 'vector-1' })
    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: install a new snapshot without mutating the previously published value', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: { p1: { x: 0, y: 0 } } }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    const publishedSnapshot = seedStore(store, 'vector-1')

    const outcome = store.updateElement(
      'vector-1',
      'computed',
      'points',
      { p1: { x: 0, y: 0 } },
      { p1: { x: 10, y: 12 } },
      { undoable: false }
    )
    await flushScheduledFrame()

    const nextSnapshot = renderMock.updateElement.mock.calls[0]?.[4]
    expect(outcome).toEqual({ status: 'applied', elementId: 'vector-1' })
    expect(nextSnapshot).not.toBe(publishedSnapshot)
    expect(publishedSnapshot).toEqual(
      expect.objectContaining({ points: { p1: { x: 0, y: 0 } } })
    )
    expect(nextSnapshot).toEqual(
      expect.objectContaining({ points: { p1: { x: 10, y: 12 } } })
    )
  })

  it('should run: stage multiple computed changes and render once from the mirror', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      {
        type: 'vector',
        visible: true,
        name: 'Vector'
      },
      {
        points: { p1: { x: 0, y: 0 } },
        segments: {},
        networks: {}
      }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    store.updateElement(
      'vector-1',
      'computed',
      'points',
      { p1: { x: 0, y: 0 } },
      { p1: { x: 12, y: 8 } },
      { undoable: false }
    )
    store.updateElement(
      'vector-1',
      'computed',
      'segments',
      {},
      { s1: { startId: 'p1' } },
      { undoable: false }
    )
    store.updateElement(
      'vector-1',
      'computed',
      'networks',
      {},
      { n1: { segmentIds: ['s1'] } },
      { undoable: false }
    )

    expect(renderMock.updateElement).not.toHaveBeenCalled()
    store.commitPendingComputedDataChanges()
    await flushScheduledFrame()

    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        id: 'vector-1',
        type: 'vector',
        points: { p1: { x: 12, y: 8 } },
        segments: { s1: { startId: 'p1' } },
        networks: { n1: { segmentIds: ['s1'] } }
      })
    )
    expect(renderMock.requestRender).toHaveBeenCalled()
    expect(renderMock.flushFrame).not.toHaveBeenCalled()
  })

  it('should run: schedule the next computed update after an empty commit', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    store.commitPendingComputedDataChanges()
    await flushScheduledFrame()
    renderMock.requestRender.mockClear()

    store.updateElement(
      'vector-1',
      'computed',
      'points',
      {},
      { p1: { x: 1, y: 1 } },
      { undoable: false }
    )

    expect(renderMock.requestRender).toHaveBeenCalledTimes(1)
    await flushScheduledFrame()
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({ points: { p1: { x: 1, y: 1 } } })
    )
  })

  it('should run: schedule the next computed update after an empty delta', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const emptyDeltaRoutes: ((
      store: InstanceType<typeof RenderSceneTree>
    ) => unknown)[] = [
      (store) => store.updateElementBatch('vector-1', [], { undoable: false }),
      (store) => store.updateElementPatch('vector-1', {}, { undoable: false })
    ]

    for (const routeEmptyDelta of emptyDeltaRoutes) {
      renderMock.requestRender.mockClear()
      renderMock.updateElement.mockClear()
      const store = new RenderSceneTree()
      const element = createElement(
        'vector-1',
        { type: 'vector', visible: true },
        { points: {} }
      )
      sceneTreeMock.getElementById.mockReturnValue(element)
      seedStore(store, 'vector-1')

      routeEmptyDelta(store)
      await flushScheduledFrame()
      renderMock.requestRender.mockClear()

      store.updateElement(
        'vector-1',
        'computed',
        'points',
        {},
        { p1: { x: 1, y: 1 } },
        { undoable: false }
      )

      expect(renderMock.requestRender).toHaveBeenCalledTimes(1)
      await flushScheduledFrame()
      expect(renderMock.updateElement).toHaveBeenCalledWith(
        'vector-1',
        'computed',
        undefined,
        undefined,
        expect.objectContaining({ points: { p1: { x: 1, y: 1 } } })
      )
    }
  })

  it('should run: apply a computed change batch as one pending render update', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      {
        type: 'vector',
        visible: true,
        name: 'Vector'
      },
      {
        points: { p1: { x: 0, y: 0 } },
        segments: {},
        networks: {}
      }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    store.updateElementBatch(
      'vector-1',
      [
        {
          owner: 'computed',
          key: 'points',
          before: { p1: { x: 0, y: 0 } },
          after: { p1: { x: 12, y: 8 } }
        },
        {
          owner: 'computed',
          key: 'segments',
          before: {},
          after: { s1: { startId: 'p1' } }
        },
        {
          owner: 'computed',
          key: 'networks',
          before: {},
          after: { n1: { segmentIds: ['s1'] } }
        }
      ],
      { undoable: false }
    )

    expect(renderMock.updateElement).not.toHaveBeenCalled()
    store.commitPendingComputedDataChanges()
    await flushScheduledFrame()

    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        points: { p1: { x: 12, y: 8 } },
        segments: { s1: { startId: 'p1' } },
        networks: { n1: { segmentIds: ['s1'] } }
      })
    )
    expect(renderMock.requestRender).toHaveBeenCalled()
    expect(renderMock.flushFrame).not.toHaveBeenCalled()
  })

  it('should run: route a direct-only batch through individual property updates', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'rectangle-1',
      { type: 'rectangle', visible: true },
      { x: 0, y: 0, points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'rectangle-1')

    const outcome = store.updateElementBatch(
      'rectangle-1',
      [
        { owner: 'computed', key: 'x', before: 0, after: 10 },
        { owner: 'computed', key: 'y', before: 0, after: 20 }
      ],
      { undoable: false }
    )

    expect(outcome).toEqual({ status: 'applied', elementId: 'rectangle-1' })
    expect(renderMock.updateElement).toHaveBeenCalledTimes(2)
    expect(renderMock.updateElement).toHaveBeenNthCalledWith(
      1,
      'rectangle-1',
      'x',
      0,
      10
    )
    expect(renderMock.updateElement).toHaveBeenNthCalledWith(
      2,
      'rectangle-1',
      'y',
      0,
      20
    )

    renderMock.updateElement.mockClear()
    store.updateElement(
      'rectangle-1',
      'computed',
      'points',
      {},
      { p1: { x: 1, y: 1 } },
      {
        undoable: false
      }
    )
    await flushScheduledFrame()

    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'rectangle-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({ x: 10, y: 20 })
    )
  })

  it('should run: route a mixed batch once through the final complete snapshot', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { x: 0, points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    store.updateElementBatch(
      'vector-1',
      [
        { owner: 'computed', key: 'x', before: 0, after: 10 },
        {
          owner: 'computed',
          key: 'points',
          before: {},
          after: { p1: { x: 10, y: 12 } }
        }
      ],
      { undoable: false }
    )

    expect(renderMock.updateElement).not.toHaveBeenCalled()
    await flushScheduledFrame()

    expect(renderMock.updateElement).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        x: 10,
        points: { p1: { x: 10, y: 12 } }
      })
    )
  })

  it('should run: preserve commit order while coalescing one element to one frame', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const initialPoints = { p1: { x: 0, y: 0 } }
    const middlePoints = { p1: { x: 10, y: 10 } }
    const finalPoints = { p1: { x: 20, y: 20 } }
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: initialPoints }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    store.updateElement(
      'vector-1',
      'computed',
      'points',
      initialPoints,
      middlePoints,
      { undoable: false }
    )
    store.updateElement(
      'vector-1',
      'computed',
      'points',
      middlePoints,
      finalPoints,
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(renderMock.updateElement).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({ points: finalPoints })
    )
  })

  it('should run: apply a computed patch as one pending render update', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      {
        type: 'vector',
        visible: true,
        name: 'Vector'
      },
      {
        x: 0,
        points: {
          A: { id: 'A', x: 0, y: 0 },
          B: { id: 'B', x: 20, y: 20 }
        },
        segments: {},
        networks: {}
      }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    store.updateElementPatch(
      'vector-1',
      {
        values: {
          x: { before: 0, after: 10 }
        },
        records: {
          points: {
            set: {
              A: {
                before: { id: 'A', x: 0, y: 0 },
                after: { id: 'A', x: 10, y: 10 }
              }
            }
          }
        }
      },
      { undoable: true }
    )

    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).not.toHaveBeenCalled()
    await flushScheduledFrame()

    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        id: 'vector-1',
        type: 'vector',
        x: 10,
        points: {
          A: { id: 'A', x: 10, y: 10 },
          B: { id: 'B', x: 20, y: 20 }
        }
      })
    )
  })

  it('should run: apply record replacement, addition, and removal atomically', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const pointA = { id: 'A', x: 0, y: 0 }
    const pointB = { id: 'B', x: 20, y: 20 }
    const nextPointA = { id: 'A', x: 10, y: 10 }
    const pointC = { id: 'C', x: 30, y: 30 }
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      {
        points: { A: pointA, B: pointB },
        segments: {},
        networks: {}
      }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    const publishedSnapshot = seedStore(store, 'vector-1')

    store.updateElementPatch(
      'vector-1',
      {
        records: {
          points: {
            set: {
              A: { before: pointA, after: nextPointA },
              C: { after: pointC }
            },
            remove: {
              B: { before: pointB }
            }
          }
        }
      },
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(publishedSnapshot).toEqual(
      expect.objectContaining({ points: { A: pointA, B: pointB } })
    )
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        points: { A: nextPointA, C: pointC }
      })
    )
  })

  it('should run: keep changes staged during a frame flush for the next frame', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      {
        type: 'vector',
        visible: true,
        name: 'Vector'
      },
      {
        points: { p1: { x: 0, y: 0 } },
        segments: {},
        networks: {}
      }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    renderMock.updateElement.mockImplementationOnce(() => {
      store.updateElement(
        'vector-1',
        'computed',
        'segments',
        {},
        { s1: { startId: 'p1' } },
        { undoable: false }
      )
    })

    store.updateElement(
      'vector-1',
      'computed',
      'points',
      { p1: { x: 0, y: 0 } },
      { p1: { x: 12, y: 8 } },
      { undoable: false }
    )
    store.commitPendingComputedDataChanges()
    await flushScheduledFrame()

    expect(renderMock.updateElement).toHaveBeenCalledTimes(1)
    expect(pendingRenderLayer?.shouldUpdate?.()).toBe(true)

    await flushScheduledFrame()

    expect(renderMock.updateElement).toHaveBeenCalledTimes(2)
    expect(renderMock.updateElement).toHaveBeenLastCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        points: { p1: { x: 12, y: 8 } },
        segments: { s1: { startId: 'p1' } }
      })
    )
  })

  it('should run: keep direct property updates mirrored for later full renders', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      {
        type: 'vector',
        visible: true,
        name: 'Vector'
      },
      {
        x: 0,
        y: 0,
        points: { p1: { x: 0, y: 0 } }
      }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    store.updateElement('vector-1', 'computed', 'x', 0, 24, {
      undoable: false
    })
    store.commitPendingComputedDataChanges()
    await flushScheduledFrame()

    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'x',
      0,
      24
    )

    renderMock.updateElement.mockClear()
    renderMock.flushFrame.mockClear()
    renderMock.requestRender.mockClear()

    store.updateElement(
      'vector-1',
      'computed',
      'points',
      { p1: { x: 0, y: 0 } },
      { p1: { x: 4, y: 6 } },
      { undoable: false }
    )
    store.commitPendingComputedDataChanges()
    await flushScheduledFrame()

    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        x: 24,
        points: { p1: { x: 4, y: 6 } }
      })
    )
    expect(renderMock.requestRender).toHaveBeenCalled()
    expect(renderMock.flushFrame).not.toHaveBeenCalled()
  })

  it('should run: apply raw-owner scalar changes without authoritative resync', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true, name: 'Before' },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    expect(
      store.updateElement('vector-1', 'raw', 'visible', true, false, {
        undoable: false
      })
    ).toEqual({ status: 'applied', elementId: 'vector-1' })
    expect(
      store.updateElement('vector-1', 'raw', 'name', 'Before', 'After', {
        undoable: false
      })
    ).toEqual({ status: 'applied', elementId: 'vector-1' })

    expect(element.save).toHaveBeenCalledTimes(1)
    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    await flushScheduledFrame()
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'visible',
      true,
      false
    )
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({ visible: false, name: 'After' })
    )
  })

  it('should run: apply a same-name computed owner without changing the raw slice', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { visible: true, width: 100, points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    expect(
      store.updateElement('vector-1', 'computed', 'visible', true, false, {
        undoable: false
      })
    ).toEqual({ status: 'applied', elementId: 'vector-1' })
    expect(
      store.updateElement('vector-1', 'computed', 'width', 100, 120, {
        undoable: false
      })
    ).toEqual({ status: 'applied', elementId: 'vector-1' })

    expect(element.save).toHaveBeenCalledTimes(1)
    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    await flushScheduledFrame()
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({ visible: false, width: 120 })
    )
  })

  it('should run: keep a shadowed raw direct change out of the visual route', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { visible: false, points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    renderMock.updateElement.mockClear()
    renderMock.requestRender.mockClear()

    expect(
      store.updateElement('vector-1', 'raw', 'visible', true, false, {
        undoable: false
      })
    ).toEqual({ status: 'applied', elementId: 'vector-1' })

    expect(element.save).toHaveBeenCalledTimes(1)
    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).not.toHaveBeenCalled()
    expect(renderMock.requestRender).not.toHaveBeenCalled()
  })

  it('should run: atomically apply mixed same-name raw and computed owners', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { visible: true, width: 100, points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    expect(
      store.updateElementBatch(
        'vector-1',
        [
          { owner: 'raw', key: 'visible', before: true, after: false },
          { owner: 'computed', key: 'visible', before: true, after: false },
          { owner: 'computed', key: 'width', before: 100, after: 120 }
        ],
        { undoable: false }
      )
    ).toEqual({ status: 'applied', elementId: 'vector-1' })

    expect(element.save).toHaveBeenCalledTimes(1)
    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    await flushScheduledFrame()
    expect(renderMock.updateElement).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({ visible: false, width: 120 })
    )
  })

  it('should run: atomically apply mixed raw and computed batch keys', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    expect(
      store.updateElementBatch(
        'vector-1',
        [
          { owner: 'raw', key: 'visible', before: true, after: false },
          {
            owner: 'computed',
            key: 'points',
            before: {},
            after: { p1: { x: 4, y: 6 } }
          }
        ],
        { undoable: false }
      )
    ).toEqual({ status: 'applied', elementId: 'vector-1' })

    expect(element.save).toHaveBeenCalledTimes(1)
    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    await flushScheduledFrame()
    expect(renderMock.updateElement).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        visible: false,
        points: { p1: { x: 4, y: 6 } }
      })
    )
  })

  it('should run: mirror computed stroke fill changes into the next render snapshot', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const initialStrokes = [
      {
        id: 'stroke-1',
        style: 'dashed',
        position: 'inside',
        width: 10,
        fill: {
          kind: 'solid',
          color: '#cccccc',
          opacity: 1
        }
      }
    ]
    const nextStrokes = [
      {
        ...initialStrokes[0],
        fill: {
          kind: 'solid',
          color: '#d90909',
          opacity: 0.5
        }
      }
    ]
    const element = createElement(
      'vector-1',
      {
        type: 'vector',
        visible: true,
        name: 'Vector'
      },
      {
        points: { p1: { x: 0, y: 0 } },
        segments: {},
        networks: {},
        strokes: initialStrokes
      }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    store.updateElement(
      'vector-1',
      'computed',
      'strokes',
      initialStrokes,
      nextStrokes,
      { undoable: false }
    )
    store.commitPendingComputedDataChanges()
    await flushScheduledFrame()

    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        strokes: nextStrokes
      })
    )
  })

  it('should run: apply an undoable update without rebuilding an explicit base', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      {
        type: 'vector',
        visible: true,
        name: 'Vector'
      },
      {
        points: { p1: { x: 0, y: 0 } },
        segments: {},
        width: 120
      }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    store.updateElement('vector-1', 'computed', 'width', 120, 160)
    store.commitPendingComputedDataChanges()
    await flushScheduledFrame()

    expect(element.getAllComputedData).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        points: { p1: { x: 0, y: 0 } },
        segments: {},
        width: 160
      })
    )
    expect(renderMock.requestRender).toHaveBeenCalled()
  })

  it('should run: preserve fresh-snapshot equivalence through action, undo, redo, and replay', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const pointBefore = { id: 'A', x: 0, y: 0 }
    const pointAfter = { id: 'A', x: 20, y: 16 }
    const replayPoint = { id: 'B', x: 30, y: 24 }
    const computedState: Record<string, unknown> = {
      width: 100,
      points: { A: pointBefore },
      segments: {}
    }
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true, name: 'Vector' },
      computedState
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    const expectLatestStrategyDataToEqualFreshSnapshot = async () => {
      await flushScheduledFrame()
      const strategyData = renderMock.updateElement.mock.calls.at(-1)?.[4]
      const freshSnapshot = {
        ...element.save(),
        ...element.getAllComputedData()
      }
      expect(strategyData).toEqual(freshSnapshot)
      renderMock.updateElement.mockClear()
    }

    computedState.width = 140
    store.updateElement('vector-1', 'computed', 'width', 100, 140)
    await expectLatestStrategyDataToEqualFreshSnapshot()

    computedState.width = 100
    store.updateElement('vector-1', 'computed', 'width', 140, 100)
    await expectLatestStrategyDataToEqualFreshSnapshot()

    computedState.width = 140
    store.updateElement('vector-1', 'computed', 'width', 100, 140)
    await expectLatestStrategyDataToEqualFreshSnapshot()

    computedState.points = { A: pointAfter, B: replayPoint }
    store.updateElementPatch('vector-1', {
      records: {
        points: {
          set: {
            A: { before: pointBefore, after: pointAfter },
            B: { after: replayPoint }
          }
        }
      }
    })
    await expectLatestStrategyDataToEqualFreshSnapshot()
  })

  it('should run: remove pending mirror data when an element is removed', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      {
        type: 'vector',
        visible: true,
        name: 'Vector'
      },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    store.updateElement(
      'vector-1',
      'computed',
      'points',
      {},
      { p1: { x: 1, y: 1 } },
      { undoable: false }
    )
    store.removeElement(
      {
        id: 'vector-1',
        type: EntityTypes.ELEMENT
      },
      undefined
    )
    store.commitPendingComputedDataChanges()
    await flushScheduledFrame()

    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1', undefined)
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: keep projection entries bounded across repeated lifecycle routes', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const first = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: { A: { id: 'A', x: 0, y: 0 } } }
    )
    const second = createElement(
      'vector-2',
      { type: 'vector', visible: true },
      { points: { B: { id: 'B', x: 10, y: 10 } } }
    )
    const third = createElement(
      'rectangle-1',
      { type: 'rectangle', visible: true },
      { width: 80, height: 60 }
    )
    const liveElements = new Map([
      ['vector-1', first],
      ['vector-2', second]
    ])
    sceneTreeMock.currentWorkspace = {
      save: () => ({ id: 'workspace-1', type: EntityTypes.WORKSPACE })
    }
    sceneTreeMock.getAllElements.mockImplementation(() => liveElements)
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      liveElements.get(elementId)
    )
    const expectStableProjectionBound = () => {
      expect(store.getProjectionSnapshotCount()).toBeLessThanOrEqual(
        liveElements.size
      )
      expect(store.hasPendingChanges()).toBe(false)
    }

    store.reload()
    expect(store.getProjectionSnapshotCount()).toBe(2)
    expectStableProjectionBound()

    liveElements.delete('vector-1')
    store.removeElement({ id: 'vector-1', type: EntityTypes.ELEMENT })
    expect(store.getProjectionSnapshotCount()).toBe(1)
    expectStableProjectionBound()

    liveElements.set('rectangle-1', third)
    store.addElementById('rectangle-1')
    expect(store.getProjectionSnapshotCount()).toBe(2)
    expectStableProjectionBound()

    const outcome = store.updateElement(
      'vector-2',
      'computed',
      'points',
      { stale: true },
      { B: { id: 'B', x: 20, y: 20 } }
    )
    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-2' })
    expect(store.getProjectionSnapshotCount()).toBe(2)
    await flushScheduledFrame()
    expectStableProjectionBound()

    liveElements.delete('vector-2')
    store.reload()
    expect(store.getProjectionSnapshotCount()).toBe(1)
    expectStableProjectionBound()

    store.addElementById('rectangle-1')
    expect(store.getProjectionSnapshotCount()).toBe(1)
    expectStableProjectionBound()

    store.resetProjection()
    store.resetProjection()
    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(store.hasPendingChanges()).toBe(false)
  })

  it('should run: clear snapshots and pending frame work idempotently', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    store.updateElement(
      'vector-1',
      'computed',
      'points',
      {},
      { p1: { x: 1, y: 1 } },
      { undoable: false }
    )

    expect(store.getProjectionSnapshotCount()).toBe(1)
    expect(store.hasPendingChanges()).toBe(true)

    store.resetProjection()
    store.resetProjection()
    await flushScheduledFrame()

    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(store.hasPendingChanges()).toBe(false)
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: clear projection state on Render teardown', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    store.updateElement(
      'vector-1',
      'computed',
      'points',
      {},
      { p1: { x: 1, y: 1 } },
      { undoable: false }
    )

    expect(pendingRenderTeardownCleanup).not.toBeNull()
    pendingRenderTeardownCleanup?.()
    pendingRenderTeardownCleanup?.()

    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(store.hasPendingChanges()).toBe(false)
    await flushScheduledFrame()
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: clear stale projection state when reload has no workspace', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    renderMock.clearElements.mockClear()
    sceneTreeMock.currentWorkspace = null

    store.reload()

    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(store.hasPendingChanges()).toBe(false)
    expect(renderMock.clearElements).toHaveBeenCalledTimes(1)
  })
})
