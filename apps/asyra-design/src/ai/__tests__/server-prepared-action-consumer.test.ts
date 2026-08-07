import { describe, expect, it, vi } from 'vitest'
import { AiActionNames, createAiActions, type AiActionApis } from '../actions'
import type { PreparedDrawingArtifact } from '../prepared-drawing-artifact'
import type { PreparedElementDescriptor } from '../../common-apis'
import { createDeferred } from './deferred'

const actionApis = (): AiActionApis => ({
  changeElementGeometry: vi.fn(),
  createCompositionElements: vi.fn(
    (descriptors: readonly PreparedElementDescriptor[]) =>
      descriptors.map(({ id }) => id)
  ),
  createCompositionGroup: vi.fn(
    (descriptor: PreparedElementDescriptor) => descriptor.id
  ),
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

const createOvalDescriptor = (
  id: string,
  name: string,
  x: number
): PreparedElementDescriptor =>
  Object.freeze({
    fills: [],
    height: 20,
    id,
    lock: false,
    name,
    props: Object.freeze({
      dimension: `${id}-dimension`,
      position: `${id}-position`
    }),
    strokes: [],
    type: 'oval',
    visible: true,
    width: 20,
    x,
    y: 0
  })

const preparedDrawingArtifact = (): PreparedDrawingArtifact => {
  const firstDescriptor = createOvalDescriptor('oval-server-1', 'Detail 1', 0)
  const secondDescriptor = createOvalDescriptor('oval-server-2', 'Detail 2', 20)
  return Object.freeze({
    artifactVersion: 1,
    compositionRole: 'cat-face',
    elementCount: 2,
    groupBounds: Object.freeze({
      height: 20,
      width: 40,
      x: 0,
      y: 0
    }),
    groupDescriptor: Object.freeze({
      children: [],
      fills: [],
      height: 20,
      id: 'group-server-1',
      lock: false,
      name: 'Cat face',
      props: Object.freeze({
        dimension: 'group-server-1-dimension',
        position: 'group-server-1-position'
      }),
      strokes: [],
      type: 'group',
      visible: true,
      width: 40,
      x: 0,
      y: 0
    }),
    parent: 'workspace',
    pointCount: 4096,
    roleToElementIds: Object.freeze({
      'detail-1': Object.freeze([firstDescriptor.id]),
      'detail-2': Object.freeze([secondDescriptor.id])
    }),
    skipped: Object.freeze([]),
    slices: Object.freeze([
      Object.freeze({
        descriptors: Object.freeze([firstDescriptor]),
        pointCount: 2048,
        roles: Object.freeze(['detail-1'])
      }),
      Object.freeze({
        descriptors: Object.freeze([secondDescriptor]),
        pointCount: 2048,
        roles: Object.freeze(['detail-2'])
      })
    ])
  })
}

describe('server-prepared Design App action consumers', () => {
  it('publishes only the backend input schema and executor contract', () => {
    const actions = createAiActions(actionApis())

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

  it('submits prepared descriptor slices after loading paint without frontend rematerialization', async () => {
    const artifact = preparedDrawingArtifact()
    const apis = actionApis()
    const loadingPaint = createDeferred<undefined>()
    const groupPaint = createDeferred<undefined>()
    const firstSlicePaint = createDeferred<undefined>()
    const secondSlicePaint = createDeferred<undefined>()
    const paintBoundaries = [
      loadingPaint,
      groupPaint,
      firstSlicePaint,
      secondSlicePaint
    ]
    const waitForPaint = vi.fn(() => {
      const next = paintBoundaries.shift()
      if (!next) {
        throw new Error('Unexpected paint boundary')
      }
      return next.promise
    })
    const yieldToHost = vi.fn(async () => undefined)
    const insert = createAiActions(apis, {
      waitForPaint,
      yieldToHost
    }).find(({ name }) => name === AiActionNames.INSERT_VECTOR_COMPOSITION)
    if (!insert) {
      throw new Error('Missing insert composition action')
    }

    const execution = insert.execute(artifact, {
      signal: new AbortController().signal
    })

    await Promise.resolve()
    expect(apis.createCompositionGroup).not.toHaveBeenCalled()

    loadingPaint.resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionGroup).toHaveBeenCalledTimes(1)
    )
    expect(apis.createCompositionElements).not.toHaveBeenCalled()
    expect(apis.createCompositionGroup).toHaveBeenCalledWith(
      artifact.groupDescriptor,
      expect.any(Object)
    )

    groupPaint.resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionElements).toHaveBeenCalledTimes(1)
    )
    expect(apis.createCompositionElements).toHaveBeenNthCalledWith(
      1,
      artifact.slices[0].descriptors,
      expect.objectContaining({ id: 'group-server-1' }),
      expect.any(Object)
    )

    firstSlicePaint.resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionElements).toHaveBeenCalledTimes(2)
    )
    expect(apis.createCompositionElements).toHaveBeenNthCalledWith(
      2,
      artifact.slices[1].descriptors,
      expect.objectContaining({ id: 'group-server-1' }),
      expect.any(Object)
    )

    secondSlicePaint.resolve(undefined)
    await expect(execution).resolves.toMatchObject({
      appliedElementIds: ['oval-server-1', 'oval-server-2'],
      compositionId: 'group-server-1',
      roleToElementIds: artifact.roleToElementIds,
      status: 'complete'
    })
    expect(waitForPaint).toHaveBeenCalledTimes(4)
    expect(yieldToHost).not.toHaveBeenCalled()
  })
})
