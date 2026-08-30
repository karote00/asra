import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EntityTypes,
  SCENE_TREE_ACTIONS,
  subscribeToDiagnosticCounters
} from '@asyra/utils'
import sceneTree from '@asyra/scene-tree'
import render from '../render.js'
import renderStrategyRegistry from '../registries/render-strategy.js'
import type { RenderStrategy } from '../types/render-strategy.js'

let pendingRenderLayer: {
  shouldUpdate?: () => boolean
  update?: () => boolean | undefined
} | null = null
let pendingRenderTeardownCleanup: (() => void) | null = null

const renderMock = vi.mocked(render)
const sceneTreeMock = vi.mocked(sceneTree)
let currentWorkspace: null | { save: () => Record<string, unknown> } = null

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
  const snapshot = renderMock.addElement.mock.calls.slice(-1)[0]?.[0] as
    Record<string, unknown> | undefined
  renderMock.addElement.mockClear()
  return snapshot
}

describe('RenderSceneTree computed data mirror', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    currentWorkspace = null
    vi.spyOn(render, 'switchWorkspace').mockImplementation(() => undefined)
    vi.spyOn(render, 'addElement').mockReturnValue({} as never)
    vi.spyOn(render, 'removeElement').mockReturnValue(undefined)
    vi.spyOn(render, 'projectHierarchy').mockImplementation(() => undefined)
    vi.spyOn(render, 'updateElement').mockImplementation(() => undefined)
    vi.spyOn(render, 'getElementById').mockReturnValue({} as never)
    vi.spyOn(render, 'clearElements').mockImplementation(() => undefined)
    vi.spyOn(render, 'flushFrame').mockImplementation(() => undefined)
    vi.spyOn(render, 'requestRender').mockImplementation(() => undefined)
    vi.spyOn(render, 'registerTeardownCleanup').mockImplementation(
      (cleanup) => {
        pendingRenderTeardownCleanup = cleanup
        return () => {
          if (pendingRenderTeardownCleanup === cleanup) {
            pendingRenderTeardownCleanup = null
          }
        }
      }
    )
    vi.spyOn(render, 'registerLayer').mockImplementation((registration) => {
      pendingRenderLayer = registration
    })
    vi.spyOn(sceneTree, 'currentWorkspace', 'get').mockImplementation(
      () => currentWorkspace as never
    )
    vi.spyOn(sceneTree, 'getAllElements').mockReturnValue(new Map())
    vi.spyOn(sceneTree, 'getElementById').mockReturnValue(undefined)
  })

  const flushScheduledFrame = async () => {
    if (pendingRenderLayer?.shouldUpdate?.()) {
      pendingRenderLayer.update?.()
      return
    }
    await Promise.resolve()
  }

  it('should run: reset projection before rebuilding a scene-tree reload', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    currentWorkspace = {
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

    expect(renderMock.clearElements).not.toHaveBeenCalled()
    expect(renderMock.switchWorkspace).toHaveBeenCalledWith({
      label: '',
      x: 0,
      y: 0
    })
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

  it('should run: fail a reload and clear partial projection when visual add fails', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    currentWorkspace = {
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
    renderMock.addElement.mockReturnValueOnce({}).mockReturnValueOnce(undefined)

    expect(() => store.reload()).toThrow(
      'Render failed to rebuild element vector-2'
    )

    expect(renderMock.addElement).toHaveBeenCalledTimes(2)
    expect(renderMock.removeElement).toHaveBeenCalledTimes(2)
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-2')
    expect(renderMock.clearElements).not.toHaveBeenCalled()
    expect(store.getProjectionSnapshotCount()).toBe(0)
  })

  it('should run: exclude workspace elements from reload snapshots', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    currentWorkspace = {
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

  it('should run: rebuild workspace-root siblings in canonical order instead of map insertion order', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const rootA = createElement(
      'root-a',
      { type: 'rectangle', parentId: 'workspace-1' },
      {}
    )
    const rootB = createElement(
      'root-b',
      { type: 'rectangle', parentId: 'workspace-1' },
      {}
    )
    const rootC = createElement(
      'root-c',
      { type: 'rectangle', parentId: 'workspace-1' },
      {}
    )
    const elements = new Map([
      ['root-c', rootC],
      ['root-b', rootB],
      ['root-a', rootA]
    ])
    currentWorkspace = {
      save: () => ({
        id: 'workspace-1',
        type: EntityTypes.WORKSPACE,
        children: ['root-a', 'root-b', 'root-c']
      })
    }
    sceneTreeMock.getAllElements.mockReturnValue(elements)
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elements.get(elementId)
    )

    store.reload()

    expect(
      renderMock.addElement.mock.calls.map(([data, siblingIndex]) => [
        data.id,
        siblingIndex
      ])
    ).toEqual([
      ['root-a', 0],
      ['root-b', 1],
      ['root-c', 2]
    ])
  })

  it('should run: rebuild a leaf without reading an absent hierarchy field', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const leafRaw = {
      type: 'rectangle',
      parentId: 'workspace-1'
    }
    const leaf = createElement('leaf-1', leafRaw, {})
    leaf.get.mockImplementation((key: string) => {
      if (key === 'id') {
        return 'leaf-1'
      }
      if (key in leafRaw) {
        return leafRaw[key as keyof typeof leafRaw]
      }
      throw new Error(`Unknown leaf field: ${key}`)
    })
    const elements = new Map([['leaf-1', leaf]])
    currentWorkspace = {
      save: () => ({
        id: 'workspace-1',
        type: EntityTypes.WORKSPACE,
        children: ['leaf-1']
      })
    }
    sceneTreeMock.getAllElements.mockReturnValue(elements)
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elements.get(elementId)
    )

    store.reload()

    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'leaf-1', type: 'rectangle' }),
      0
    )
  })

  it('should run: rebuild nested siblings after their parent in canonical order', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const group = createElement(
      'group-1',
      {
        type: 'group',
        parentId: 'workspace-1',
        children: ['child-a', 'child-b', 'child-c']
      },
      {}
    )
    const childA = createElement(
      'child-a',
      { type: 'rectangle', parentId: 'group-1' },
      {}
    )
    const childB = createElement(
      'child-b',
      { type: 'rectangle', parentId: 'group-1' },
      {}
    )
    const childC = createElement(
      'child-c',
      { type: 'rectangle', parentId: 'group-1' },
      {}
    )
    const elements = new Map([
      ['child-c', childC],
      ['group-1', group],
      ['child-b', childB],
      ['child-a', childA]
    ])
    currentWorkspace = {
      save: () => ({
        id: 'workspace-1',
        type: EntityTypes.WORKSPACE,
        children: ['group-1']
      })
    }
    sceneTreeMock.getAllElements.mockReturnValue(elements)
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elements.get(elementId)
    )

    store.reload()

    expect(
      renderMock.addElement.mock.calls.map(([data, siblingIndex]) => [
        data.id,
        siblingIndex
      ])
    ).toEqual([
      ['group-1', 0],
      ['child-a', 0],
      ['child-b', 1],
      ['child-c', 2]
    ])
  })

  it('projects exact hierarchy moves target-first without add/remove recreation', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const workspaceRaw = {
      id: 'workspace-1',
      type: EntityTypes.WORKSPACE,
      children: ['source', 'target']
    }
    const sourceRaw = {
      type: EntityTypes.GROUP,
      parentId: 'workspace-1',
      children: ['child']
    }
    const targetRaw = {
      type: EntityTypes.GROUP,
      parentId: 'workspace-1',
      children: ['sibling']
    }
    const childRaw = {
      type: 'rectangle',
      parentId: 'source'
    }
    const siblingRaw = {
      type: 'rectangle',
      parentId: 'target'
    }
    const elements = new Map([
      ['workspace-1', createElement('workspace-1', workspaceRaw, {})],
      ['source', createElement('source', sourceRaw, {})],
      ['target', createElement('target', targetRaw, {})],
      ['child', createElement('child', childRaw, {})],
      ['sibling', createElement('sibling', siblingRaw, {})]
    ])
    currentWorkspace = { save: () => ({ ...workspaceRaw }) }
    sceneTreeMock.getAllElements.mockReturnValue(elements as never)
    sceneTreeMock.getElementById.mockImplementation(
      (elementId) => elements.get(elementId) as never
    )
    store.reload()
    renderMock.addElement.mockClear()
    renderMock.removeElement.mockClear()
    renderMock.projectHierarchy.mockClear()

    sourceRaw.children = []
    targetRaw.children = ['sibling', 'child']
    childRaw.parentId = 'target'

    expect(
      store.moveElements([
        {
          elementId: 'child',
          before: { parentId: 'source', index: 0 },
          after: { parentId: 'target', index: 1 }
        }
      ])
    ).toEqual({ status: 'applied', elementId: 'child' })
    expect(renderMock.projectHierarchy.mock.calls).toEqual([
      ['target', ['sibling', 'child']],
      ['source', []]
    ])
    expect(renderMock.addElement).not.toHaveBeenCalled()
    expect(renderMock.removeElement).not.toHaveBeenCalled()
  })

  it('projects moved children into the workspace when the settled source parent is already removed', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const workspaceRaw = {
      id: 'workspace-1',
      type: EntityTypes.WORKSPACE,
      children: ['group']
    }
    const groupRaw = {
      type: EntityTypes.GROUP,
      parentId: 'workspace-1',
      children: ['first', 'second']
    }
    const firstRaw = {
      type: 'rectangle',
      parentId: 'group'
    }
    const secondRaw = {
      type: 'rectangle',
      parentId: 'group'
    }
    const elements = new Map([
      ['workspace-1', createElement('workspace-1', workspaceRaw, {})],
      ['group', createElement('group', groupRaw, {})],
      ['first', createElement('first', firstRaw, {})],
      ['second', createElement('second', secondRaw, {})]
    ])
    currentWorkspace = { save: () => ({ ...workspaceRaw }) }
    sceneTreeMock.getAllElements.mockReturnValue(elements as never)
    sceneTreeMock.getElementById.mockImplementation(
      (elementId) => elements.get(elementId) as never
    )
    store.reload()
    renderMock.addElement.mockClear()
    renderMock.removeElement.mockClear()
    renderMock.projectHierarchy.mockClear()

    workspaceRaw.children = ['first', 'second']
    firstRaw.parentId = 'workspace-1'
    secondRaw.parentId = 'workspace-1'
    elements.delete('group')

    expect(
      store.moveElements([
        {
          elementId: 'first',
          before: { parentId: 'group', index: 0 },
          after: { parentId: 'workspace-1', index: 1 }
        },
        {
          elementId: 'second',
          before: { parentId: 'group', index: 1 },
          after: { parentId: 'workspace-1', index: 2 }
        }
      ])
    ).toEqual({ status: 'applied', elementId: 'first' })
    expect(renderMock.projectHierarchy.mock.calls).toEqual([
      ['workspace-1', ['first', 'second']]
    ])
    expect(renderMock.addElement).not.toHaveBeenCalled()
    expect(renderMock.removeElement).not.toHaveBeenCalled()
  })

  it('projects subtree removal descendant-first and restoration parent-first', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const workspaceRaw = {
      id: 'workspace-1',
      type: EntityTypes.WORKSPACE,
      children: ['group']
    }
    const groupRaw = {
      id: 'group',
      type: EntityTypes.GROUP,
      parentId: 'workspace-1',
      children: ['child']
    }
    const childRaw = {
      id: 'child',
      type: 'rectangle',
      parentId: 'group'
    }
    const group = createElement('group', groupRaw, {})
    const child = createElement('child', childRaw, {})
    const elements = new Map([
      ['workspace-1', createElement('workspace-1', workspaceRaw, {})],
      ['group', group],
      ['child', child]
    ])
    currentWorkspace = { save: () => ({ ...workspaceRaw }) }
    sceneTreeMock.getAllElements.mockReturnValue(elements as never)
    sceneTreeMock.getElementById.mockImplementation(
      (elementId) => elements.get(elementId) as never
    )
    store.reload()
    renderMock.addElement.mockClear()
    renderMock.removeElement.mockClear()

    const removed = [
      {
        elementId: 'child',
        parentId: 'group',
        index: 0,
        data: { ...childRaw }
      },
      {
        elementId: 'group',
        parentId: 'workspace-1',
        index: 0,
        data: { ...groupRaw }
      }
    ]
    elements.delete('group')
    elements.delete('child')
    workspaceRaw.children = []

    expect(
      store.applySubtreeChange({
        action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
        undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
        eventName: 'changeSubtree',
        elementId: 'group',
        rootParentChildrenAfter: [],
        removed
      })
    ).toEqual({ status: 'removed', elementId: 'group' })
    expect(
      renderMock.removeElement.mock.calls.map(([elementId]) => elementId)
    ).toEqual(['child', 'group'])

    elements.set('group', group)
    elements.set('child', child)
    workspaceRaw.children = ['group']
    renderMock.addElement.mockClear()

    expect(
      store.applySubtreeChange({
        action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
        undoAction: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
        eventName: 'changeSubtree',
        elementId: 'group',
        rootParentChildrenAfter: [],
        removed
      })
    ).toEqual({ status: 'applied', elementId: 'group' })
    expect(
      renderMock.addElement.mock.calls.map(([data, siblingIndex]) => [
        data.id,
        siblingIndex
      ])
    ).toEqual([
      ['group', 0],
      ['child', 0]
    ])
  })

  it('should run: synchronize parent mirrors from add and remove hierarchy envelopes', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const parentRaw = {
      type: 'group',
      visible: true,
      children: ['child-a', 'child-c']
    }
    const parent = createElement('group-1', parentRaw, { revision: 0 })
    const child = createElement(
      'child-b',
      {
        type: 'rectangle',
        visible: true,
        parentId: 'group-1'
      },
      { width: 20, height: 20 }
    )
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elementId === 'group-1' ? parent : child
    )
    seedStore(store, 'group-1')

    parentRaw.children = ['child-a', 'child-b', 'child-c']
    expect(store.addElementById('child-b', 'group-1', 1)).toEqual({
      status: 'applied',
      elementId: 'child-b'
    })
    await flushScheduledFrame()

    expect(renderMock.updateElement).toHaveBeenLastCalledWith(
      'group-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        id: 'group-1',
        children: ['child-a', 'child-b', 'child-c']
      })
    )

    renderMock.updateElement.mockClear()
    parentRaw.children = ['child-a', 'child-c']
    expect(
      store.removeElement(
        { id: 'child-b', type: EntityTypes.ELEMENT },
        'group-1',
        1
      )
    ).toEqual({ status: 'removed', elementId: 'child-b' })
    await flushScheduledFrame()

    expect(renderMock.updateElement).toHaveBeenLastCalledWith(
      'group-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        id: 'group-1',
        children: ['child-a', 'child-c']
      })
    )
  })

  it('projects delayed child add envelopes against an already-final parent mirror without resync', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const counters = new Map<string, number>()
    const unsubscribe = subscribeToDiagnosticCounters((name, value) => {
      counters.set(name, (counters.get(name) ?? 0) + value)
    })
    const parentRaw = {
      type: 'group',
      parentId: 'workspace-1',
      visible: true,
      children: ['child-a', 'child-b', 'child-c']
    }
    const elements = new Map([
      ['group-1', createElement('group-1', parentRaw, {})],
      [
        'child-a',
        createElement(
          'child-a',
          { type: 'rectangle', parentId: 'group-1' },
          { height: 10, width: 10 }
        )
      ],
      [
        'child-b',
        createElement(
          'child-b',
          { type: 'rectangle', parentId: 'group-1' },
          { height: 10, width: 10 }
        )
      ],
      [
        'child-c',
        createElement(
          'child-c',
          { type: 'rectangle', parentId: 'group-1' },
          { height: 10, width: 10 }
        )
      ]
    ])
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elements.get(elementId)
    )
    const store = new RenderSceneTree()

    try {
      expect(store.addElementById('group-1', 'workspace-1', 0)).toEqual({
        status: 'applied',
        elementId: 'group-1'
      })
      for (const [index, elementId] of parentRaw.children.entries()) {
        expect(store.addElementById(elementId, 'group-1', index)).toEqual({
          status: 'applied',
          elementId
        })
      }
    } finally {
      unsubscribe()
    }

    expect(
      renderMock.addElement.mock.calls.map(([data, siblingIndex]) => [
        data.id,
        siblingIndex
      ])
    ).toEqual([
      ['group-1', 0],
      ['child-a', 0],
      ['child-b', 1],
      ['child-c', 2]
    ])
    expect(counters.get('computed-mirror-projection-mismatch') ?? 0).toBe(0)
    expect(counters.get('computed-mirror-seed-resync') ?? 0).toBe(0)
  })

  it('applies one canonical parent relationship batch while projecting every child', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const counters = new Map<string, number>()
    const unsubscribe = subscribeToDiagnosticCounters((name, value) => {
      counters.set(name, (counters.get(name) ?? 0) + value)
    })
    const parentRaw = {
      type: 'group',
      parentId: 'workspace-1',
      visible: true,
      children: [] as string[]
    }
    const childIds = ['child-a', 'child-b', 'child-c']
    const elements = new Map([
      ['group-1', createElement('group-1', parentRaw, {})],
      ...childIds.map(
        (elementId) =>
          [
            elementId,
            createElement(
              elementId,
              { type: 'rectangle', parentId: 'group-1' },
              { height: 10, width: 10 }
            )
          ] as const
      )
    ])
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elements.get(elementId)
    )
    const store = new RenderSceneTree()

    try {
      expect(store.addElementById('group-1', 'workspace-1', 0)).toEqual({
        status: 'applied',
        elementId: 'group-1'
      })
      parentRaw.children = [...childIds]
      const ownKeys = vi.spyOn(Reflect, 'ownKeys')
      let ownKeyEnumerationCount = 0
      try {
        expect(
          store.addElements(
            childIds.slice(0, 2).map((elementId, index) => ({
              data: {
                id: elementId,
                type: 'rectangle',
                parentId: 'group-1'
              },
              index,
              parentId: 'group-1'
            }))
          )
        ).toEqual(
          childIds.slice(0, 2).map((elementId) => ({
            status: 'applied',
            elementId
          }))
        )
        expect(
          store.addElements([
            {
              data: {
                id: childIds[2],
                type: 'rectangle',
                parentId: 'group-1'
              },
              index: 2,
              parentId: 'group-1'
            }
          ])
        ).toEqual([
          {
            status: 'applied',
            elementId: childIds[2]
          }
        ])
        ownKeyEnumerationCount = ownKeys.mock.calls.length
      } finally {
        ownKeys.mockRestore()
      }
      expect(ownKeyEnumerationCount).toBe(0)
      await flushScheduledFrame()
    } finally {
      unsubscribe()
    }

    expect(
      renderMock.addElement.mock.calls.map(([data, siblingIndex]) => [
        data.id,
        siblingIndex
      ])
    ).toEqual([
      ['group-1', 0],
      ['child-a', 0],
      ['child-b', 1],
      ['child-c', 2]
    ])
    expect(counters.get('computed-mirror-staged-change-count') ?? 0).toBe(2)
    expect(counters.get('computed-mirror-projection-mismatch') ?? 0).toBe(0)
    expect(counters.get('computed-mirror-seed-resync') ?? 0).toBe(0)
    expect(counters.get('computed-mirror-child-add-batch-apply') ?? 0).toBe(2)
    expect(counters.get('computed-mirror-child-id-cache-hit') ?? 0).toBe(1)
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('projects exact addition and removal batches without reading future raw snapshots', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const groupRaw = {
      type: EntityTypes.GROUP,
      parentId: 'workspace-1',
      visible: true,
      children: [] as string[]
    }
    const childRaw = {
      id: 'child-a',
      type: 'rectangle',
      parentId: 'group-1',
      visible: true
    }
    const group = createElement('group-1', groupRaw, {})
    const child = createElement('child-a', childRaw, { height: 10, width: 10 })
    const elements = new Map([
      ['group-1', group],
      ['child-a', child]
    ])
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elements.get(elementId)
    )
    const store = new RenderSceneTree()

    expect(store.addElementById('group-1', 'workspace-1', 0)).toEqual({
      status: 'applied',
      elementId: 'group-1'
    })
    group.save.mockClear()
    child.save.mockClear()
    renderMock.updateElement.mockClear()

    groupRaw.children = ['child-a', 'child-b']
    expect(
      store.addElements([
        {
          data: childRaw,
          parentId: 'group-1',
          index: 0
        }
      ])
    ).toEqual([{ status: 'applied', elementId: 'child-a' }])
    await flushScheduledFrame()

    expect(group.save).not.toHaveBeenCalled()
    expect(child.save).not.toHaveBeenCalled()
    expect(renderMock.updateElement).not.toHaveBeenCalled()

    renderMock.updateElement.mockClear()
    group.save.mockClear()
    expect(
      store.removeElements([
        {
          data: childRaw,
          parentId: 'group-1',
          index: 0
        }
      ])
    ).toEqual([{ status: 'removed', elementId: 'child-a' }])
    await flushScheduledFrame()

    expect(group.save).not.toHaveBeenCalled()
    expect(renderMock.updateElement).toHaveBeenCalledTimes(1)
    expect(renderMock.updateElement).toHaveBeenLastCalledWith(
      'group-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        id: 'group-1',
        children: []
      })
    )
  })

  it('removes projected children when a later owner event already removed their canonical parent', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const groupRaw = {
      id: 'group-1',
      type: EntityTypes.GROUP,
      parentId: 'workspace-1',
      visible: true,
      children: [] as string[]
    }
    const childEntries = ['child-a', 'child-b'].map((elementId, index) => ({
      data: {
        id: elementId,
        type: 'rectangle',
        parentId: 'group-1',
        visible: true
      },
      parentId: 'group-1',
      index
    }))
    const elements = new Map([
      ['group-1', createElement('group-1', groupRaw, {})],
      ...childEntries.map(
        ({ data }) =>
          [
            data.id,
            createElement(data.id, data, { height: 10, width: 10 })
          ] as const
      )
    ])
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elements.get(elementId)
    )
    const store = new RenderSceneTree()

    expect(store.addElementById('group-1', 'workspace-1', 0)).toEqual({
      status: 'applied',
      elementId: 'group-1'
    })
    groupRaw.children = childEntries.map(({ data }) => data.id)
    expect(store.addElements(childEntries)).toEqual([
      { status: 'applied', elementId: 'child-a' },
      { status: 'applied', elementId: 'child-b' }
    ])
    await flushScheduledFrame()
    renderMock.removeElement.mockClear()

    elements.clear()

    expect(store.removeElements(childEntries)).toEqual([
      { status: 'removed', elementId: 'child-a' },
      { status: 'removed', elementId: 'child-b' }
    ])
    expect(renderMock.removeElement.mock.calls).toEqual([
      ['child-a', 'group-1'],
      ['child-b', 'group-1']
    ])

    expect(store.removeElement(groupRaw, 'workspace-1', 0)).toEqual({
      status: 'removed',
      elementId: 'group-1'
    })
    expect(store.getProjectionSnapshotCount()).toBe(0)
  })

  it('rejects missing parents and stale batch indexes without canonical resync', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const missingParentChildRaw = {
      id: 'missing-parent-child',
      type: 'rectangle',
      parentId: 'missing-parent',
      visible: true
    }
    const missingParentChild = createElement(
      'missing-parent-child',
      missingParentChildRaw,
      { height: 10, width: 10 }
    )
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elementId === 'missing-parent-child' ? missingParentChild : undefined
    )
    const store = new RenderSceneTree()

    expect(
      store.addElements([
        {
          data: missingParentChildRaw,
          parentId: 'missing-parent',
          index: 0
        }
      ])
    ).toEqual([{ status: 'failed', elementId: 'missing-parent-child' }])
    expect(renderMock.addElement).not.toHaveBeenCalled()

    const groupRaw = {
      type: EntityTypes.GROUP,
      parentId: 'workspace-1',
      visible: true,
      children: [] as string[]
    }
    const childRaw = {
      id: 'child-a',
      type: 'rectangle',
      parentId: 'group-1',
      visible: true
    }
    const group = createElement('group-1', groupRaw, {})
    const child = createElement('child-a', childRaw, { height: 10, width: 10 })
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      new Map([
        ['group-1', group],
        ['child-a', child]
      ]).get(elementId)
    )
    expect(store.addElementById('group-1', 'workspace-1', 0)).toEqual({
      status: 'applied',
      elementId: 'group-1'
    })
    group.save.mockClear()
    renderMock.addElement.mockClear()

    groupRaw.children = ['child-a']
    expect(
      store.addElements([
        {
          data: childRaw,
          parentId: 'group-1',
          index: 1
        }
      ])
    ).toEqual([{ status: 'failed', elementId: 'child-a' }])
    expect(group.save).not.toHaveBeenCalled()

    groupRaw.children = []
    expect(
      store.removeElements([
        {
          data: childRaw,
          parentId: 'group-1',
          index: 1
        }
      ])
    ).toEqual([{ status: 'failed', elementId: 'child-a' }])
    expect(group.save).not.toHaveBeenCalled()
    expect(renderMock.removeElement).toHaveBeenCalledTimes(1)
    expect(renderMock.removeElement).toHaveBeenCalledWith('child-a')
  })

  it('compensates a failed visual batch removal so the same evidence can retry', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const groupRaw = {
      type: EntityTypes.GROUP,
      parentId: 'workspace-1',
      visible: true,
      children: [] as string[]
    }
    const childEntries = ['child-a', 'child-b'].map((elementId, index) => ({
      data: {
        id: elementId,
        type: 'rectangle',
        parentId: 'group-1',
        visible: true
      },
      parentId: 'group-1',
      index
    }))
    const group = createElement('group-1', groupRaw, {})
    const elements = new Map([
      ['group-1', group],
      ...childEntries.map(
        ({ data }) =>
          [
            data.id,
            createElement(data.id, data, { height: 10, width: 10 })
          ] as const
      )
    ])
    sceneTreeMock.getElementById.mockImplementation((elementId: string) =>
      elements.get(elementId)
    )
    const store = new RenderSceneTree()

    expect(store.addElementById('group-1', 'workspace-1', 0)).toEqual({
      status: 'applied',
      elementId: 'group-1'
    })
    groupRaw.children = childEntries.map(({ data }) => data.id)
    expect(store.addElements(childEntries)).toEqual([
      { status: 'applied', elementId: 'child-a' },
      { status: 'applied', elementId: 'child-b' }
    ])
    await flushScheduledFrame()
    group.save.mockClear()
    renderMock.addElement.mockClear()
    renderMock.removeElement.mockClear()

    groupRaw.children = []
    const releaseFailure = new Error('batch visual release failed')
    renderMock.removeElement
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw releaseFailure
      })

    expect(() => store.removeElements(childEntries)).toThrow(releaseFailure)
    expect(store.getProjectionSnapshotCount()).toBe(3)
    expect(group.save).not.toHaveBeenCalled()
    expect(renderMock.addElement).toHaveBeenCalledOnce()
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'child-a' }),
      0
    )

    renderMock.addElement.mockClear()
    renderMock.removeElement.mockReset()
    renderMock.removeElement.mockReturnValue(undefined)
    expect(store.removeElements(childEntries)).toEqual([
      { status: 'removed', elementId: 'child-a' },
      { status: 'removed', elementId: 'child-b' }
    ])
    expect(store.getProjectionSnapshotCount()).toBe(1)
    expect(group.save).not.toHaveBeenCalled()
  })

  it('should run: fail closed for invalid explicit add snapshots', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const cases = [
      {
        elementId: 'vector-1',
        element: {
          get: vi.fn((key: string) => {
            if (key === 'id') {
              return 'vector-1'
            }
            if (key === 'type') {
              return 'vector'
            }
            return
          }),
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({ points: { p1: { x: 1, y: 1 } } })
    )
  })

  it('should run: add a missing visual from a successful complete resync', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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

  it('should run: fail a resync when rebuilding an existing visual fails', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    renderMock.addElement.mockReturnValueOnce(undefined)

    const outcome = store.updateElement(
      'vector-1',
      'computed',
      'points',
      { stale: true },
      { p1: { x: 10, y: 12 } },
      { undoable: false }
    )

    expect(outcome).toEqual({ status: 'failed', elementId: 'vector-1' })
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vector-1',
        points: { p1: { x: 10, y: 12 } }
      })
    )
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    expect(renderMock.updateElement).not.toHaveBeenCalled()
    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(store.hasPendingChanges()).toBe(false)
  })

  it('should run: reject a scalar before mismatch without mutating the published snapshot', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({ points: { p1: { x: 10, y: 12 } } })
    )
  })

  it('should run: reject a dense before value for a cached sparse array', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const element = createElement(
      'generic-1',
      { type: 'generic', visible: true },
      { samples: Array(1) }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'generic-1')
    element.getAllComputedData.mockReturnValue({ samples: [456] })

    const outcome = store.updateElement(
      'generic-1',
      'computed',
      'samples',
      [123],
      [456],
      { undoable: false }
    )

    expect(outcome).toEqual({ status: 'resynced', elementId: 'generic-1' })
    expect(element.getAllComputedData).toHaveBeenCalledTimes(2)
  })

  it('should run: resync an own undefined slot for a cached sparse array', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const element = createElement(
      'generic-1',
      { type: 'generic', visible: true },
      { samples: Array(1) }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'generic-1')
    element.getAllComputedData.mockReturnValue({ samples: [456] })

    const outcome = store.updateElement(
      'generic-1',
      'computed',
      'samples',
      [undefined],
      [456],
      { undoable: false }
    )

    expect(outcome).toEqual({ status: 'resynced', elementId: 'generic-1' })
    expect(element.getAllComputedData).toHaveBeenCalledTimes(2)
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({ samples: [456] })
    )
  })

  it('should run: compare enumerable named own properties on arrays', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const cachedSamples = Object.assign([123], { source: 'cached' })
    const suppliedBefore = Object.assign([123], { source: 'stale' })
    const canonicalSamples = Object.assign([456], { source: 'canonical' })
    const element = createElement(
      'generic-1',
      { type: 'generic', visible: true },
      { samples: cachedSamples }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'generic-1')
    element.getAllComputedData.mockReturnValue({
      samples: canonicalSamples
    })

    const outcome = store.updateElement(
      'generic-1',
      'computed',
      'samples',
      suppliedBefore,
      [456],
      { undoable: false }
    )

    expect(outcome).toEqual({ status: 'resynced', elementId: 'generic-1' })
    expect(element.getAllComputedData).toHaveBeenCalledTimes(2)
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({ samples: canonicalSamples })
    )
  })

  it('should run: compare enumerable symbol own properties on arrays', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const source = Symbol('sample-source')
    const createSamples = (value: number, metadata: string) => {
      const samples = [value]
      Object.defineProperty(samples, source, {
        configurable: true,
        enumerable: true,
        value: metadata,
        writable: true
      })
      return samples
    }
    const cachedSamples = createSamples(123, 'cached')
    const suppliedBefore = createSamples(123, 'stale')
    const canonicalSamples = createSamples(456, 'canonical')
    const element = createElement(
      'generic-1',
      { type: 'generic', visible: true },
      { samples: cachedSamples }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'generic-1')
    element.getAllComputedData.mockReturnValue({
      samples: canonicalSamples
    })

    const outcome = store.updateElement(
      'generic-1',
      'computed',
      'samples',
      suppliedBefore,
      [456],
      { undoable: false }
    )

    expect(outcome).toEqual({ status: 'resynced', elementId: 'generic-1' })
    expect(element.getAllComputedData).toHaveBeenCalledTimes(2)
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({ samples: canonicalSamples })
    )
  })

  it('should run: reject a scalar without declared owner provenance', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({
        points: { p1: { x: 10, y: 12 } },
        segments: { s1: { startId: 'p1' } }
      })
    )
  })

  it('should run: reject a whole batch when any owner provenance is invalid', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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

  it('should run: resync a value patch whose top-level base is absent', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    element.getAllComputedData.mockReturnValue({
      points: {},
      pointCoordinateSpace: 'workspace'
    })

    const outcome = store.updateElementPatch(
      'vector-1',
      {
        values: {
          pointCoordinateSpace: {
            before: undefined,
            after: 'workspace'
          }
        }
      },
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(element.getAllComputedData).toHaveBeenCalledTimes(2)
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({ pointCoordinateSpace: 'workspace' })
    )
  })

  it('should run: resync a record patch whose special-name base is inherited', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    const canonicalComputed: Record<string, unknown> = { points: {} }
    Object.defineProperty(canonicalComputed, '__proto__', {
      value: { child: 'canonical' },
      enumerable: true,
      configurable: true,
      writable: true
    })
    element.getAllComputedData.mockReturnValue(canonicalComputed)
    const records: Record<string, unknown> = {}
    Object.defineProperty(records, '__proto__', {
      value: { set: { child: { after: 'delta' } } },
      enumerable: true,
      configurable: true,
      writable: true
    })

    const outcome = store.updateElementPatch(
      'vector-1',
      { records },
      { undoable: false }
    )
    await flushScheduledFrame()

    const snapshot = renderMock.addElement.mock.calls.slice(-1)[0]?.[0] as
      Record<string, unknown> | undefined
    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(
      Object.prototype.hasOwnProperty.call(snapshot ?? {}, '__proto__')
    ).toBe(true)
    expect(snapshot?.['__proto__']).toEqual({ child: 'canonical' })
  })

  it('should run: reject a record patch without an existing record base', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({
        points: { p1: { id: 'p1', x: 0, y: 0 } }
      })
    )
  })

  it('should run: treat an inherited record before value as an addition', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const initialPoint = { id: 'A', x: 0, y: 0 }
    const canonicalPoint = { id: 'A', x: 20, y: 20 }
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: { A: initialPoint } }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    element.getAllComputedData.mockReturnValue({
      points: { A: canonicalPoint }
    })
    const inheritedChange = Object.assign(
      Object.create({ before: initialPoint }) as {
        before: typeof initialPoint
        after: typeof initialPoint
      },
      { after: { id: 'A', x: 10, y: 10 } }
    )

    const outcome = store.updateElementPatch(
      'vector-1',
      {
        records: {
          points: {
            set: { A: inheritedChange }
          }
        }
      },
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(element.getAllComputedData).toHaveBeenCalledTimes(2)
    expect(renderMock.addElement).toHaveBeenCalledWith(
      expect.objectContaining({ points: { A: canonicalPoint } })
    )
  })

  it('should run: compare distinct cyclic scalar values without overflowing', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const cachedBefore: Record<string, unknown> = { label: 'before' }
    cachedBefore.self = cachedBefore
    const suppliedBefore: Record<string, unknown> = { label: 'before' }
    suppliedBefore.self = suppliedBefore
    const after: Record<string, unknown> = { label: 'after' }
    after.self = after
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { metadata: cachedBefore }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')

    const outcome = store.updateElement(
      'vector-1',
      'computed',
      'metadata',
      suppliedBefore,
      after,
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(outcome).toEqual({ status: 'applied', elementId: 'vector-1' })
    expect(renderMock.updateElement).toHaveBeenCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({ metadata: after })
    )
  })

  it('should run: resync when cyclic before values have different topology', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const cachedBefore: Record<string, unknown> = { label: 'before' }
    cachedBefore.next = cachedBefore
    const suppliedBefore: Record<string, unknown> = { label: 'before' }
    const suppliedPeer: Record<string, unknown> = { label: 'before' }
    suppliedBefore.next = suppliedPeer
    suppliedPeer.next = suppliedBefore
    const canonicalAfter: Record<string, unknown> = { label: 'after' }
    canonicalAfter.next = canonicalAfter
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { metadata: cachedBefore }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    element.getAllComputedData.mockReturnValue({ metadata: canonicalAfter })

    const outcome = store.updateElement(
      'vector-1',
      'computed',
      'metadata',
      suppliedBefore,
      canonicalAfter,
      { undoable: false }
    )
    await flushScheduledFrame()

    expect(outcome).toEqual({ status: 'resynced', elementId: 'vector-1' })
    expect(element.getAllComputedData).toHaveBeenCalledTimes(2)
  })

  it('should run: store a __proto__ record id as an own projected value', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    const after = { id: '__proto__', x: 10, y: 20 }
    const set = Object.create(null) as Record<string, { after: typeof after }>
    Object.defineProperty(set, '__proto__', {
      enumerable: true,
      value: { after }
    })

    const outcome = store.updateElementPatch(
      'vector-1',
      { records: { points: { set } } },
      { undoable: false }
    )
    await flushScheduledFrame()

    const snapshot = renderMock.updateElement.mock.calls.slice(-1)[0]?.[4] as
      { points?: Record<string, unknown> } | undefined
    expect(outcome).toEqual({ status: 'applied', elementId: 'vector-1' })
    expect(Object.getPrototypeOf(snapshot?.points)).toBe(Object.prototype)
    expect(
      Object.prototype.hasOwnProperty.call(snapshot?.points, '__proto__')
    ).toBe(true)
    expect(snapshot?.points?.__proto__).toBe(after)
  })

  it('should run: remove stale output when a mismatch has no canonical element', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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

  it('routes strategy-owned Vector dimensions without a geometry strategy rebuild', async () => {
    const strategy = Object.assign(vi.fn(), {
      directPropertyKeys: Object.freeze(['width', 'height'])
    }) as RenderStrategy & { readonly directPropertyKeys: readonly string[] }
    renderStrategyRegistry.register('transform-only-vector', strategy)

    try {
      const { RenderSceneTree } = await import('../stores/scene-tree.js')
      const store = new RenderSceneTree()
      const element = createElement(
        'vector-1',
        { type: 'transform-only-vector', visible: true },
        {
          width: 100,
          height: 80,
          points: Object.fromEntries(
            Array.from({ length: 7_001 }, (_, index) => [
              `point-${index}`,
              { x: index, y: index % 17 }
            ])
          )
        }
      )
      sceneTreeMock.getElementById.mockReturnValue(element)
      seedStore(store, 'vector-1')
      element.getAllComputedData.mockClear()

      const outcome = store.updateElementBatch(
        'vector-1',
        [
          {
            owner: 'computed',
            key: 'width',
            before: 100,
            after: 140
          },
          {
            owner: 'computed',
            key: 'height',
            before: 80,
            after: 120
          }
        ],
        { undoable: false }
      )

      expect(outcome).toEqual({
        status: 'applied',
        elementId: 'vector-1'
      })
      expect(renderMock.updateElement).toHaveBeenCalledTimes(2)
      expect(renderMock.updateElement).toHaveBeenNthCalledWith(
        1,
        'vector-1',
        'width',
        100,
        140
      )
      expect(renderMock.updateElement).toHaveBeenNthCalledWith(
        2,
        'vector-1',
        'height',
        80,
        120
      )
      expect(element.getAllComputedData).not.toHaveBeenCalled()
      expect(strategy).not.toHaveBeenCalled()
    } finally {
      renderStrategyRegistry.unregister('transform-only-vector')
    }
  })

  it('should run: route a mixed batch once through the final complete snapshot', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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

  it('should run: retain a complete snapshot for the next frame when its handoff fails', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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

    const handoffFailure = new Error('hierarchy handoff failed')
    renderMock.updateElement.mockImplementationOnce(() => {
      throw handoffFailure
    })

    store.updateElement(
      'vector-1',
      'computed',
      'points',
      { p1: { x: 0, y: 0 } },
      { p1: { x: 12, y: 8 } },
      { undoable: false }
    )

    expect(() => pendingRenderLayer?.update?.()).toThrow(handoffFailure)
    expect(store.hasPendingChanges()).toBe(true)

    expect(pendingRenderLayer?.update?.()).toBe(true)
    expect(store.hasPendingChanges()).toBe(false)
    expect(renderMock.updateElement).toHaveBeenCalledTimes(2)
    expect(renderMock.updateElement).toHaveBeenLastCalledWith(
      'vector-1',
      'computed',
      undefined,
      undefined,
      expect.objectContaining({
        points: { p1: { x: 12, y: 8 } }
      })
    )
  })

  it('should run: keep direct property updates mirrored for later full renders', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
      const strategyData = renderMock.updateElement.mock.calls.slice(-1)[0]?.[4]
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    currentWorkspace = {
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
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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

  it('should run: clear only Scene Tree-projected visual ids', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'vector-1')
    renderMock.removeElement.mockClear()
    renderMock.clearElements.mockClear()

    store.clearProjection()

    expect(renderMock.removeElement).toHaveBeenCalledTimes(1)
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    expect(renderMock.clearElements).not.toHaveBeenCalled()
    expect(renderMock.switchWorkspace).toHaveBeenCalledWith({
      label: '',
      x: 0,
      y: 0
    })
  })

  it('should run: retain failed cleanup ownership and retry without skipping other ids', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const elements = new Map([
      [
        'vector-failed',
        createElement(
          'vector-failed',
          { type: 'vector', visible: true },
          { points: {} }
        )
      ],
      [
        'vector-released',
        createElement(
          'vector-released',
          { type: 'vector', visible: true },
          { points: {} }
        )
      ]
    ])
    sceneTreeMock.getElementById.mockImplementation((id: string) =>
      elements.get(id)
    )
    seedStore(store, 'vector-failed')
    seedStore(store, 'vector-released')
    const releaseFailure = new Error('engine release failed')
    renderMock.removeElement.mockImplementationOnce(() => {
      throw releaseFailure
    })

    expect(() => store.clearProjection()).toThrow(releaseFailure)

    expect(renderMock.removeElement.mock.calls).toEqual([
      ['vector-failed'],
      ['vector-released']
    ])
    expect(store.getProjectionSnapshotCount()).toBe(1)
    expect(renderMock.switchWorkspace).toHaveBeenCalledWith({
      label: '',
      x: 0,
      y: 0
    })

    renderMock.removeElement.mockClear()
    store.clearProjection()

    expect(renderMock.removeElement).toHaveBeenCalledTimes(1)
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-failed')
    expect(store.getProjectionSnapshotCount()).toBe(0)
  })

  it('should run: retry a single remove whose visual release fails', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const element = createElement(
      'remove-retry',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'remove-retry')
    const releaseFailure = new Error('single remove release failed')
    renderMock.removeElement.mockImplementationOnce(() => {
      throw releaseFailure
    })

    expect(() =>
      store.removeElement({ id: 'remove-retry', type: EntityTypes.ELEMENT })
    ).toThrow(releaseFailure)
    expect(store.getProjectionSnapshotCount()).toBe(1)

    store.clearProjection()

    expect(renderMock.removeElement.mock.calls).toEqual([
      ['remove-retry', undefined],
      ['remove-retry']
    ])
    expect(store.getProjectionSnapshotCount()).toBe(0)
  })

  it('should run: retry visual cleanup after an add rebuild and release both fail', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const element = createElement(
      'add-retry',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    renderMock.addElement.mockReturnValueOnce(undefined)
    const releaseFailure = new Error('add cleanup release failed')
    renderMock.removeElement.mockImplementationOnce(() => {
      throw releaseFailure
    })

    expect(() => store.addElementById('add-retry')).toThrow(releaseFailure)

    store.clearProjection()

    expect(renderMock.removeElement.mock.calls).toEqual([
      ['add-retry'],
      ['add-retry']
    ])
    expect(store.getProjectionSnapshotCount()).toBe(0)
  })

  it('should run: retry visual cleanup after a resync seed and release both fail', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const element = createElement(
      'resync-retry',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    seedStore(store, 'resync-retry')
    element.getAllComputedData.mockImplementationOnce(() => {
      throw new Error('resync seed failed')
    })
    const releaseFailure = new Error('resync cleanup release failed')
    renderMock.removeElement.mockImplementationOnce(() => {
      throw releaseFailure
    })

    expect(() =>
      store.updateElement(
        'resync-retry',
        'computed',
        'points',
        { stale: true },
        { next: true }
      )
    ).toThrow(releaseFailure)

    store.clearProjection()

    expect(renderMock.removeElement.mock.calls).toEqual([
      ['resync-retry'],
      ['resync-retry']
    ])
    expect(store.getProjectionSnapshotCount()).toBe(0)
  })

  it('should run: clear projection state on Render teardown', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
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
    renderMock.removeElement.mockClear()
    renderMock.clearElements.mockClear()

    expect(pendingRenderTeardownCleanup).not.toBeNull()
    pendingRenderTeardownCleanup?.()
    pendingRenderTeardownCleanup?.()

    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(store.hasPendingChanges()).toBe(false)
    expect(renderMock.removeElement).toHaveBeenCalledTimes(1)
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    expect(renderMock.clearElements).not.toHaveBeenCalled()
    await flushScheduledFrame()
    expect(renderMock.updateElement).not.toHaveBeenCalled()
  })

  it('should run: clear stale projection state when reload has no workspace', async () => {
    const { RenderSceneTree } = await import('../stores/scene-tree.js')
    const store = new RenderSceneTree()
    const element = createElement(
      'vector-1',
      { type: 'vector', visible: true },
      { points: {} }
    )
    sceneTreeMock.getElementById.mockReturnValue(element)
    currentWorkspace = {
      save: () => ({
        id: 'workspace-old',
        type: EntityTypes.WORKSPACE,
        children: ['vector-1']
      })
    }
    sceneTreeMock.getAllElements.mockReturnValue(
      new Map([['vector-1', element]])
    )

    store.reload()

    expect(store.getProjectionSnapshotCount()).toBe(1)
    renderMock.removeElement.mockClear()
    renderMock.clearElements.mockClear()
    currentWorkspace = null

    store.reload()

    expect(
      (store as unknown as { _workspace?: unknown })._workspace ?? null
    ).toBeNull()
    expect(store.getProjectionSnapshotCount()).toBe(0)
    expect(store.hasPendingChanges()).toBe(false)
    expect(renderMock.removeElement).toHaveBeenCalledTimes(1)
    expect(renderMock.removeElement).toHaveBeenCalledWith('vector-1')
    expect(renderMock.clearElements).not.toHaveBeenCalled()
  })
})
