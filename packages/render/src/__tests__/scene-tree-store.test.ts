import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EntityTypes } from '@asyra/utils'

let pendingRenderLayer: {
  shouldUpdate?: () => boolean
  update?: () => boolean | undefined
} | null = null

const renderMock = {
  switchWorkspace: vi.fn(),
  addElement: vi.fn(),
  removeElement: vi.fn(),
  updateElement: vi.fn(),
  flushFrame: vi.fn(),
  requestRender: vi.fn(),
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

describe('RenderSceneTree computed data mirror', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    store.updateElement(
      'vector-1',
      'points',
      {},
      { p1: { x: 12, y: 8 } },
      { undoable: false }
    )
    store.updateElement(
      'vector-1',
      'segments',
      {},
      { s1: { startId: 'p1' } },
      { undoable: false }
    )
    store.updateElement(
      'vector-1',
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

    store.updateElementBatch(
      'vector-1',
      [
        {
          key: 'points',
          before: {},
          after: { p1: { x: 12, y: 8 } }
        },
        {
          key: 'segments',
          before: {},
          after: { s1: { startId: 'p1' } }
        },
        {
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

    renderMock.updateElement.mockImplementationOnce(() => {
      store.updateElement(
        'vector-1',
        'segments',
        {},
        { s1: { startId: 'p1' } },
        { undoable: false }
      )
    })

    store.updateElement(
      'vector-1',
      'points',
      {},
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

    store.updateElement('vector-1', 'x', 0, 24, { undoable: false })
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
      'points',
      {},
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

    store.updateElement(
      'vector-1',
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
})
