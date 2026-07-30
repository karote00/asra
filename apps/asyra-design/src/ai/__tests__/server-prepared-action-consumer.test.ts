import { describe, expect, it, vi } from 'vitest'
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
  setDrawingProgress: vi.fn(),
  setElementVisible: vi.fn(() => true),
  updateElementFillColor: vi.fn(() => true),
  updateElementFillColors: vi.fn(() => []),
  updateElementStrokeColor: vi.fn(() => true),
  updateElementStrokeColors: vi.fn(() => [])
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

describe('server-prepared Asyra Design action consumers', () => {
  it('publishes only the backend input schema and executor contract', () => {
    const actions = createAsyraDesignAiActions(actionApis())

    actions.forEach((action) => {
      expect(Reflect.ownKeys(action).sort()).toEqual([
        'description',
        'execute',
        'inputSchema',
        'name'
      ])
      expect(action.inputSchema).toEqual(expect.any(Object))
      expect(action).not.toHaveProperty('schema')
      expect(action).not.toHaveProperty('prepare')
    })
  })

  it('materializes only the next compact progressive slice after loading paint', async () => {
    const apis = actionApis()
    const loadingPaint = createDeferred<undefined>()
    const firstSlicePaint = createDeferred<undefined>()
    const finalPaint = createDeferred<undefined>()
    const paintBoundaries = [loadingPaint, firstSlicePaint, finalPaint]
    const waitForPaint = vi.fn(() => {
      const next = paintBoundaries.shift()
      if (!next) {
        throw new Error('Unexpected paint boundary')
      }
      return next.promise
    })
    const insert = createAsyraDesignAiActions(apis, {
      waitForPaint
    }).find(
      ({ name }) => name === AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
    )
    if (!insert) {
      throw new Error('Missing insert composition action')
    }

    const execution = insert.execute(compactVectorArtifact(), {
      signal: new AbortController().signal
    })

    await Promise.resolve()
    expect(apis.createCompositionGroup).not.toHaveBeenCalled()
    expect(apis.createCompositionElements).not.toHaveBeenCalled()

    loadingPaint.resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionElements).toHaveBeenCalledTimes(1)
    )
    expect(waitForPaint).toHaveBeenCalledTimes(2)
    expect(apis.createCompositionGroup).toHaveBeenCalledOnce()
    expect(
      vi
        .mocked(apis.createCompositionElements)
        .mock.calls[0]?.[0].map(({ role }) => role)
    ).toEqual(['detail-0'])
    expect(apis.createCompositionElements).toHaveBeenCalledTimes(1)

    firstSlicePaint.resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionElements).toHaveBeenCalledTimes(2)
    )
    expect(
      vi
        .mocked(apis.createCompositionElements)
        .mock.calls[1]?.[0].map(({ role }) => role)
    ).toEqual(['detail-1', 'detail-2'])

    finalPaint.resolve(undefined)
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
})
