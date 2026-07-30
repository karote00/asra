import { afterEach, describe, expect, it, vi } from 'vitest'
import { elementApis, hierarchyApis } from '../../common-apis'
import {
  AsyraDesignAiActionNames,
  createAsyraDesignAiActions,
  type AsyraDesignAiActionApis,
  type ServerPreparedInsertVectorCompositionArgs
} from '../actions'
import { createDeferred } from './deferred'

const actionApis = (): AsyraDesignAiActionApis => ({
  changeElementGeometry: vi.fn(),
  createCompositionElement: vi.fn(),
  createCompositionElements: vi.fn(
    (items: readonly { readonly role: string }[]) =>
      items.map(({ role }) => `${role}-id`)
  ),
  createCompositionGroup: vi.fn(() => 'cat-group-id'),
  getElementBounds: vi.fn(),
  getElementFillColor: vi.fn(),
  getElementStrokeColor: vi.fn(),
  getElementType: vi.fn(),
  removeSubtree: vi.fn(() => ({ removed: [] })),
  scaleVectorElementGeometry: vi.fn(() => true),
  selectElements: vi.fn(),
  setElementVisible: vi.fn(() => true),
  updateElementFillColor: vi.fn(() => true),
  updateElementStrokeColor: vi.fn(() => true)
})

const compactVectorArtifact = (): ServerPreparedInsertVectorCompositionArgs => {
  const pointCounts = [2048, 2048, 1] as const
  const coordinates = new Float64Array(
    pointCounts.reduce((total, count) => total + count * 2, 0)
  )
  const paths: {
    closed: boolean
    coordinateOffset: number
    pointCount: number
  }[] = []
  let coordinateOffset = 0

  pointCounts.forEach((pointCount, itemIndex) => {
    paths.push({
      closed: false,
      coordinateOffset,
      pointCount
    })
    for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
      coordinates[coordinateOffset + pointIndex * 2] =
        itemIndex * 100 + pointIndex
      coordinates[coordinateOffset + pointIndex * 2 + 1] = itemIndex * 10
    }
    coordinateOffset += pointCount * 2
  })

  return {
    artifactVersion: 1,
    compositionRole: 'cat-face',
    coordinates: coordinates.buffer,
    groupBounds: {
      height: 100,
      width: 300,
      x: 0,
      y: 0
    },
    items: pointCounts.map((pointCount, index) => ({
      bounds: {
        height: 100,
        width: 100,
        x: index * 100,
        y: 0
      },
      pathCount: 1,
      pathStart: index,
      pointCount,
      primitive: 'vector' as const,
      role: `detail-${index}`,
      style: {
        strokeColor: '#000000',
        strokeWidth: 1
      },
      vectorEncoding: 'points' as const
    })),
    parent: 'workspace',
    paths,
    pointCount: pointCounts.reduce((total, count) => total + count, 0),
    skipped: []
  }
}

describe('server-prepared Asyra Design action consumer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes only the compact server artifact instead of the expanded items contract', () => {
    const insert = createAsyraDesignAiActions(actionApis()).find(
      ({ name }) => name === AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
    )
    if (!insert) {
      throw new Error('Missing insert composition action')
    }

    expect(insert.inputSchema.required).toEqual([
      'artifactVersion',
      'compositionRole',
      'coordinates',
      'groupBounds',
      'items',
      'parent',
      'paths',
      'pointCount',
      'skipped'
    ])
    expect(insert.inputSchema.properties).not.toHaveProperty('itemPointCounts')

    const artifact = compactVectorArtifact()
    expect(artifact.coordinates).toBeInstanceOf(ArrayBuffer)
    artifact.items.forEach((item) => {
      expect(item).not.toHaveProperty('points')
      expect(item).not.toHaveProperty('paths')
    })
    artifact.paths.forEach((path) => {
      expect(path).not.toHaveProperty('points')
    })
  })

  it('materializes only the current progressive slice in one Group', async () => {
    const apis = actionApis()
    const firstBoundary = createDeferred<undefined>()
    const finalBoundary = createDeferred<undefined>()
    const boundaries = [firstBoundary, finalBoundary]
    const yieldToHost = vi.fn(() => {
      const boundary = boundaries.shift()
      if (!boundary) {
        throw new Error('Unexpected cooperative boundary')
      }
      return boundary.promise
    })
    const insert = createAsyraDesignAiActions(apis, {
      yieldToHost
    }).find(
      ({ name }) => name === AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
    )
    if (!insert) {
      throw new Error('Missing insert composition action')
    }

    const execution = insert.execute(compactVectorArtifact(), {
      signal: new AbortController().signal
    })

    expect(apis.createCompositionGroup).toHaveBeenCalledOnce()
    expect(apis.createCompositionElements).toHaveBeenCalledTimes(1)
    expect(
      vi
        .mocked(apis.createCompositionElements)
        .mock.calls[0]?.[0].map(({ role }) => role)
    ).toEqual(['detail-0'])

    firstBoundary.resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionElements).toHaveBeenCalledTimes(2)
    )
    expect(
      vi
        .mocked(apis.createCompositionElements)
        .mock.calls[1]?.[0].map(({ role }) => role)
    ).toEqual(['detail-1', 'detail-2'])
    expect(apis.createCompositionElement).not.toHaveBeenCalled()

    finalBoundary.resolve(undefined)
    await expect(execution).resolves.toMatchObject({
      appliedElementIds: ['detail-0-id', 'detail-1-id', 'detail-2-id'],
      compositionId: 'cat-group-id',
      status: 'complete'
    })
    expect(apis.createCompositionGroup).toHaveBeenCalledWith(
      expect.any(Object),
      {
        sharedDelivery: 'immediate',
        undoable: true
      }
    )
  })

  it('routes every materialized slice through createElementsInParent', async () => {
    vi.spyOn(hierarchyApis, 'getWorkspaceId').mockReturnValue('workspace-id')
    vi.spyOn(elementApis, 'createElement').mockReturnValue('cat-group-id')
    const createElementsInParent = vi
      .spyOn(elementApis, 'createElementsInParent')
      .mockImplementation((items) =>
        items.map((_, index) => `element-${index}`)
      )
    const insert = createAsyraDesignAiActions(undefined, {
      yieldToHost: async () => undefined
    }).find(
      ({ name }) => name === AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
    )
    if (!insert) {
      throw new Error('Missing insert composition action')
    }

    await insert.execute(compactVectorArtifact(), {
      signal: new AbortController().signal
    })

    expect(createElementsInParent).toHaveBeenCalledTimes(2)
    expect(
      createElementsInParent.mock.calls.map(([items]) => items.length)
    ).toEqual([1, 2])
    createElementsInParent.mock.calls.forEach(([, parentId, options]) => {
      expect(parentId).toBe('cat-group-id')
      expect(options).toEqual({
        sharedDelivery: 'immediate',
        undoable: true
      })
    })
    expect(elementApis).not.toHaveProperty('createElements')
  })

  it('preserves server path order and closed topology while materializing a slice', async () => {
    const apis = actionApis()
    apis.createCompositionElements = vi.fn(() => ['topology-id'])
    const coordinates = new Float64Array([10, 20, 30, 40, 50, 60, 70, 80])
    const artifact: ServerPreparedInsertVectorCompositionArgs = {
      artifactVersion: 1,
      compositionRole: 'topology-reference',
      coordinates: coordinates.buffer,
      groupBounds: {
        height: 60,
        width: 60,
        x: 10,
        y: 20
      },
      items: [
        {
          bounds: {
            height: 60,
            width: 60,
            x: 10,
            y: 20
          },
          pathCount: 2,
          pathStart: 0,
          pointCount: 4,
          primitive: 'vector',
          role: 'ordered-paths',
          style: {
            strokeColor: '#000000'
          },
          vectorEncoding: 'paths'
        }
      ],
      parent: 'workspace',
      paths: [
        {
          closed: true,
          coordinateOffset: 0,
          pointCount: 2
        },
        {
          closed: false,
          coordinateOffset: 4,
          pointCount: 2
        }
      ],
      pointCount: 4,
      skipped: []
    }
    const insert = createAsyraDesignAiActions(apis, {
      yieldToHost: async () => undefined
    }).find(
      ({ name }) => name === AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
    )
    if (!insert) {
      throw new Error('Missing insert composition action')
    }

    await insert.execute(artifact, {
      signal: new AbortController().signal
    })

    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      [
        {
          bounds: artifact.items[0].bounds,
          paths: [
            {
              closed: true,
              points: [
                { x: 10, y: 20 },
                { x: 30, y: 40 }
              ]
            },
            {
              closed: false,
              points: [
                { x: 50, y: 60 },
                { x: 70, y: 80 }
              ]
            }
          ],
          primitive: 'vector',
          role: 'ordered-paths',
          style: {
            strokeColor: '#000000'
          }
        }
      ],
      expect.objectContaining({
        id: 'cat-group-id'
      }),
      {
        sharedDelivery: 'immediate',
        undoable: true
      }
    )
  })
})
