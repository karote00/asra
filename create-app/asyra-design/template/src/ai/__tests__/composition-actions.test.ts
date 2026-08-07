import { describe, expect, it, vi } from 'vitest'
import {
  subscribeToBrowserDragPhases,
  subscribeToDiagnosticCounters
} from '@asyra/utils'
import {
  AiActionError,
  AiActionNames,
  createAiActions,
  type AiColorUpdate,
  type AiCompositionItem
} from '../actions'
import type { PreparedElementDescriptor } from '../../common-apis'
import {
  PREPARED_DRAWING_SLICE_ELEMENT_BUDGET,
  PREPARED_DRAWING_SLICE_POINT_BUDGET,
  type PreparedDrawingArtifact
} from '../prepared-drawing-artifact'
import { createDeferred } from './deferred'

const mutationOptions = {
  sharedDelivery: 'immediate',
  undoable: true
} as const

const canonicalElementIds = (
  orderedElementIds: readonly string[]
): readonly string[] => Object.freeze([...orderedElementIds])

const ovalItem = (role = 'left-eye') => ({
  bounds: {
    height: 70,
    width: 58,
    x: 594,
    y: 300
  },
  primitive: 'oval',
  role,
  style: {
    fillColor: '#FFFDF7',
    strokeColor: '#5B3A29',
    strokeWidth: 3
  }
})

const vectorItem = (role = 'left-whisker-1') => ({
  bounds: {
    height: 22,
    width: 158,
    x: 472,
    y: 372
  },
  closed: false,
  points: [
    { x: 630, y: 394 },
    { x: 472, y: 372 }
  ],
  primitive: 'vector',
  role,
  style: {
    strokeColor: '#5B3A29',
    strokeWidth: 3
  }
})

const vectorItemWithPointCount = (pointCount: number, role: string) => ({
  ...vectorItem(role),
  points: Array.from({ length: pointCount }, (_, index) => ({
    x: 472 + (index % 158),
    y: 372 + (index % 22)
  }))
})

const actionApis = () => ({
  changeElementGeometry: vi.fn(),
  createCompositionElements: vi.fn(
    (descriptors: readonly PreparedElementDescriptor[]) =>
      canonicalElementIds(descriptors.map(({ id }) => id))
  ),
  createCompositionGroup: vi.fn(
    (descriptor: PreparedElementDescriptor) => descriptor.id
  ),
  getElementBounds: vi.fn(),
  getElementFillColor: vi.fn(),
  getElementStrokeColor: vi.fn(),
  getElementType: vi.fn(),
  removeSubtree: vi.fn(),
  scaleVectorElementGeometry: vi.fn(() => true),
  selectElements: vi.fn(),
  setDrawingProgress: vi.fn(),
  setElementVisible: vi.fn(() => true),
  updateElementFillColor: vi.fn(() => true),
  updateElementFillColors: vi.fn((updates: readonly AiColorUpdate[]) =>
    updates.map(() => true)
  ),
  updateElementStrokeColor: vi.fn(() => true),
  updateElementStrokeColors: vi.fn((updates: readonly AiColorUpdate[]) =>
    updates.map(() => true)
  )
})

const actionByName = (
  name: string,
  apis: ReturnType<typeof actionApis>,
  options?: {
    readonly waitForPaint?: () => Promise<void>
    readonly yieldToHost?: () => Promise<void>
  }
) => {
  const action = createAiActions(apis, {
    ...options
  }).find((candidate) => candidate.name === name)
  if (!action) {
    throw new Error(`Missing test action: ${name}`)
  }
  return action
}

const executionContext = () => ({
  signal: new AbortController().signal
})

interface TestCompositionDescriptor {
  readonly compositionRole: string
  readonly items: readonly AiCompositionItem[]
  readonly parent: 'workspace'
}

const createServerPreparedCompositionArtifact = (
  value: unknown
): PreparedDrawingArtifact => {
  const descriptor = value as TestCompositionDescriptor
  const acceptedItems: AiCompositionItem[] = []
  const skipped: {
    reason: 'duplicate-role'
    role: string
  }[] = []
  const seenRoles = new Set<string>()
  for (const item of descriptor.items) {
    if (seenRoles.has(item.role)) {
      skipped.push({
        reason: 'duplicate-role',
        role: item.role
      })
      continue
    }
    seenRoles.add(item.role)
    acceptedItems.push(item)
  }

  const groupBounds = acceptedItems.reduce((bounds, item) => {
    const x = Math.min(bounds.x, item.bounds.x)
    const y = Math.min(bounds.y, item.bounds.y)
    return {
      height:
        Math.max(bounds.y + bounds.height, item.bounds.y + item.bounds.height) -
        y,
      width:
        Math.max(bounds.x + bounds.width, item.bounds.x + item.bounds.width) -
        x,
      x,
      y
    }
  }, acceptedItems[0].bounds)

  const pointCountForItem = (item: AiCompositionItem): number =>
    item.primitive === 'vector'
      ? (item.paths ?? [{ points: item.points ?? [] }]).reduce(
          (total, path) => total + path.points.length,
          0
        )
      : 0
  const preparedDescriptors = acceptedItems.map(
    (item): PreparedElementDescriptor => {
      const elementId = `${item.role}-id`
      const propertyId = (propertyName: string) =>
        `${elementId}-${propertyName}`
      const common = {
        fills: [],
        height: item.bounds.height,
        id: elementId,
        lock: false,
        name: item.role,
        props: Object.freeze({
          dimension: propertyId('dimension'),
          fills: propertyId('fills'),
          position: propertyId('position'),
          strokes: propertyId('strokes')
        }),
        strokes: [],
        type: item.primitive,
        visible: true,
        width: item.bounds.width,
        x: item.bounds.x - groupBounds.x,
        y: item.bounds.y - groupBounds.y
      } as const
      if (item.primitive === 'oval') {
        return Object.freeze(common)
      }
      return Object.freeze({
        ...common,
        closed: item.closed === true,
        networks: {},
        pointCoordinateSpace: 'workspace',
        points: {},
        props: Object.freeze({
          ...common.props,
          closed: propertyId('closed'),
          fillRule: propertyId('fillRule'),
          networks: propertyId('networks'),
          pointCoordinateSpace: propertyId('pointCoordinateSpace'),
          points: propertyId('points'),
          segments: propertyId('segments')
        }),
        segments: {}
      })
    }
  )
  const roleToElementIds: Record<string, readonly string[]> = {}
  const pupilIds: string[] = []
  const whiskerIds: string[] = []
  acceptedItems.forEach((item, index) => {
    const elementId = preparedDescriptors[index].id
    roleToElementIds[item.role] = Object.freeze([elementId])
    if (item.role.includes('pupil')) pupilIds.push(elementId)
    if (item.role.includes('whisker')) whiskerIds.push(elementId)
  })
  if (pupilIds.length > 0) {
    roleToElementIds.pupils = Object.freeze(pupilIds)
  }
  if (whiskerIds.length > 0) {
    roleToElementIds.whiskers = Object.freeze(whiskerIds)
  }

  const slices: {
    descriptors: PreparedElementDescriptor[]
    pointCount: number
    roles: string[]
  }[] = []
  let currentDescriptors: PreparedElementDescriptor[] = []
  let currentPointCount = 0
  let currentRoles: string[] = []
  const flushSlice = () => {
    if (currentDescriptors.length === 0) return
    slices.push({
      descriptors: currentDescriptors,
      pointCount: currentPointCount,
      roles: currentRoles
    })
    currentDescriptors = []
    currentPointCount = 0
    currentRoles = []
  }
  acceptedItems.forEach((item, index) => {
    const itemPointCount = pointCountForItem(item)
    if (
      currentDescriptors.length > 0 &&
      (currentDescriptors.length >= PREPARED_DRAWING_SLICE_ELEMENT_BUDGET ||
        currentPointCount + itemPointCount >
          PREPARED_DRAWING_SLICE_POINT_BUDGET)
    ) {
      flushSlice()
    }
    currentDescriptors.push(preparedDescriptors[index])
    currentPointCount += itemPointCount
    currentRoles.push(item.role)
  })
  flushSlice()

  return {
    artifactVersion: 1,
    compositionRole: descriptor.compositionRole,
    elementCount: preparedDescriptors.length,
    groupBounds,
    groupDescriptor: Object.freeze({
      children: [],
      fills: [],
      height: groupBounds.height,
      id: 'cat-group-id',
      lock: false,
      name: descriptor.compositionRole,
      props: Object.freeze({
        dimension: 'cat-group-id-dimension',
        fills: 'cat-group-id-fills',
        position: 'cat-group-id-position',
        strokes: 'cat-group-id-strokes'
      }),
      strokes: [],
      type: 'group',
      visible: true,
      width: groupBounds.width,
      x: groupBounds.x,
      y: groupBounds.y
    }),
    parent: descriptor.parent,
    pointCount: acceptedItems.reduce(
      (totalPointCount, item) => totalPointCount + pointCountForItem(item),
      0
    ),
    roleToElementIds: Object.freeze(roleToElementIds),
    skipped,
    slices: slices.map((slice) =>
      Object.freeze({
        descriptors: Object.freeze(slice.descriptors),
        pointCount: slice.pointCount,
        roles: Object.freeze(slice.roles)
      })
    )
  }
}

const executePrepared = async (
  action: ReturnType<typeof actionByName>,
  value: unknown,
  context = executionContext()
) =>
  action.execute(
    action.name === AiActionNames.INSERT_VECTOR_COMPOSITION
      ? createServerPreparedCompositionArtifact(value)
      : value,
    context
  )

describe('Asyra Design AI composition action catalog', () => {
  it('registers the six server-facing actions in deterministic order', () => {
    expect(createAiActions(actionApis()).map(({ name }) => name)).toEqual([
      AiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
      AiActionNames.INSERT_VECTOR_COMPOSITION,
      AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      AiActionNames.REMOVE_AI_COMPOSITION,
      AiActionNames.SET_ELEMENT_VISIBILITY,
      AiActionNames.SELECT_ELEMENTS
    ])
  })
})

describe('Asyra Design AI composition action execution', () => {
  it('consumes server-prepared composition evidence without client preparation', async () => {
    const apis = actionApis()
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)
    const prepared = createServerPreparedCompositionArtifact({
      compositionRole: 'cat-face',
      items: [ovalItem(), vectorItem()],
      parent: 'workspace'
    })
    const phaseNames: string[] = []
    const unsubscribe = subscribeToBrowserDragPhases((name) =>
      phaseNames.push(name)
    )

    try {
      await action.execute(prepared, executionContext())
    } finally {
      unsubscribe()
    }

    expect(phaseNames).toEqual(
      expect.arrayContaining([
        'ai-app:create-composition-group',
        'ai-app:create-composition-batch'
      ])
    )
    expect(phaseNames).not.toContain('ai-app:prepare-composition')
  })

  it('creates one canonical Group for one valid vectorized item', async () => {
    const apis = actionApis()
    const item = vectorItem('reference-vector-000001')
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)
    const argumentsValue = {
      compositionRole: 'vectorized-image',
      items: [item],
      parent: 'workspace'
    }

    await expect(
      executePrepared(action, argumentsValue, executionContext())
    ).resolves.toMatchObject({
      appliedElementIds: ['reference-vector-000001-id'],
      compositionId: 'cat-group-id',
      status: 'complete'
    })
    const prepared = createServerPreparedCompositionArtifact(argumentsValue)
    expect(apis.createCompositionGroup).toHaveBeenCalledOnce()
    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      prepared.slices[0].descriptors,
      {
        id: 'cat-group-id'
      },
      mutationOptions
    )
  })

  it('submits one validated composition batch into the precreated Group', async () => {
    const apis = actionApis()
    const items = [vectorItem('fur-1'), vectorItem('fur-2')]
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(['fur-1-id', 'fur-2-id'])
    )
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)

    await expect(
      executePrepared(
        action,
        {
          compositionRole: 'cat-face',
          items,
          parent: 'workspace'
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      appliedElementIds: ['fur-1-id', 'fur-2-id'],
      compositionId: 'cat-group-id',
      status: 'complete'
    })
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    const prepared = createServerPreparedCompositionArtifact({
      compositionRole: 'cat-face',
      items,
      parent: 'workspace'
    })
    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      prepared.slices[0].descriptors,
      {
        id: 'cat-group-id'
      },
      mutationOptions
    )
  })

  it('submits one large accepted composition as ordered progressive batches', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      vectorItem(`fur-${index}`)
    )
    const orderedElementIds = items.map(({ role }) => `${role}-id`)
    apis.createCompositionElements.mockImplementation(
      (batch: readonly PreparedElementDescriptor[]) =>
        canonicalElementIds(batch.map(({ id }) => id))
    )
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)

    await expect(
      executePrepared(
        action,
        {
          compositionRole: 'cat-face',
          items,
          parent: 'workspace'
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      appliedElementIds: orderedElementIds,
      compositionId: 'cat-group-id',
      status: 'complete'
    })
    expect(apis.createCompositionElements).toHaveBeenCalledTimes(
      Math.ceil(items.length / PREPARED_DRAWING_SLICE_ELEMENT_BUDGET)
    )
    expect(
      apis.createCompositionElements.mock.calls.flatMap(([batch]) =>
        batch.map(({ id }) => id)
      )
    ).toEqual(orderedElementIds)
    expect(
      apis.createCompositionElements.mock.calls.every(
        ([, parent, options]) =>
          parent.id === 'cat-group-id' &&
          options.sharedDelivery === 'immediate' &&
          options.undoable === true
      )
    ).toBe(true)
    expect(apis.createCompositionGroup).toHaveBeenCalledOnce()
  })

  it('paints exact accepted bounds before the first canonical mutation and clears terminal state', async () => {
    const apis = actionApis()
    const calls: string[] = []
    apis.setDrawingProgress.mockImplementation(
      (
        state: {
          readonly bounds: {
            readonly height: number
            readonly width: number
            readonly x: number
            readonly y: number
          }
          readonly completedElements: number
          readonly phase: 'drawing' | 'preparing'
          readonly totalElements: number
        } | null
      ) => {
        calls.push(
          state
            ? `progress:${state.phase}:${state.completedElements}/${state.totalElements}:${state.bounds.x},${state.bounds.y},${state.bounds.width},${state.bounds.height}`
            : 'progress:clear'
        )
      }
    )
    apis.createCompositionGroup.mockImplementation(() => {
      calls.push('canonical:group')
      return 'cat-group-id'
    })
    apis.createCompositionElements.mockImplementation((descriptors) => {
      calls.push('canonical:children')
      return canonicalElementIds(descriptors.map(({ id }) => id))
    })
    const yieldToHost = vi.fn(async () => {
      calls.push('paint')
    })
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis, {
      yieldToHost
    })

    await executePrepared(
      action,
      {
        compositionRole: 'cat-face',
        items: [ovalItem(), vectorItem()],
        parent: 'workspace'
      },
      executionContext()
    )

    expect(calls).toEqual([
      'progress:preparing:0/2:472,300,180,94',
      'paint',
      'canonical:group',
      'paint',
      'canonical:children',
      'progress:drawing:2/2:472,300,180,94',
      'paint',
      'progress:clear'
    ])
  })

  it('splits zero-point progressive primitives by element count and reports only completed batches', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      ovalItem(`detail-${index}`)
    )
    apis.createCompositionElements.mockImplementation(
      (batch: readonly PreparedElementDescriptor[]) =>
        canonicalElementIds(batch.map(({ id }) => id))
    )
    const yieldToHost = vi.fn(async () => undefined)
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis, {
      yieldToHost
    })

    await executePrepared(
      action,
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(
      apis.createCompositionElements.mock.calls.map(([batch]) => batch.length)
    ).toEqual([
      ...Array.from(
        { length: 16 },
        () => PREPARED_DRAWING_SLICE_ELEMENT_BUDGET
      ),
      1
    ])
    expect(
      apis.setDrawingProgress.mock.calls
        .map(([state]) => state)
        .filter((state) => state?.phase === 'drawing')
        .map(({ completedElements }) => completedElements)
    ).toEqual([
      ...Array.from(
        { length: 16 },
        (_, index) => (index + 1) * PREPARED_DRAWING_SLICE_ELEMENT_BUDGET
      ),
      513
    ])
    expect(apis.createCompositionGroup).toHaveBeenCalledWith(
      expect.any(Object),
      mutationOptions
    )
    expect(PREPARED_DRAWING_SLICE_ELEMENT_BUDGET).toBe(32)
    expect(yieldToHost).toHaveBeenCalledTimes(19)
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('emits post-paint milestones from actual completed progressive batches', async () => {
    const counters: (readonly [string, number])[] = []
    const unsubscribe = subscribeToDiagnosticCounters((name, value) =>
      counters.push([name, value])
    )
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      ovalItem(`detail-${index}`)
    )
    apis.createCompositionElements.mockImplementation(
      (batch: readonly PreparedElementDescriptor[]) =>
        canonicalElementIds(batch.map(({ id }) => id))
    )
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis, {
      yieldToHost: async () => undefined
    })

    try {
      await executePrepared(
        action,
        {
          compositionRole: 'cat-face',
          items,
          parent: 'workspace'
        },
        executionContext()
      )

      expect(
        counters.filter(([name]) => name.startsWith('ai-drawing:'))
      ).toEqual([
        ['ai-drawing:loading-frame-visible', 1],
        ...Array.from(
          { length: 16 },
          (_, index) =>
            [
              'ai-drawing:visible-element-count',
              (index + 1) * PREPARED_DRAWING_SLICE_ELEMENT_BUDGET
            ] as const
        ),
        ['ai-drawing:visible-element-count', 513],
        ['ai-drawing:cooperative-yield-count', 17]
      ])
    } finally {
      unsubscribe()
    }
  })

  it('keeps one cooperative host boundary in flight and never starts the next ordered batch early', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 72 }, (_, index) =>
      ovalItem(`detail-${index}`)
    )
    apis.createCompositionElements.mockImplementation(
      (batch: readonly PreparedElementDescriptor[]) =>
        canonicalElementIds(batch.map(({ id }) => id))
    )
    const boundaries = [
      createDeferred<undefined>(),
      createDeferred<undefined>(),
      createDeferred<undefined>(),
      createDeferred<undefined>(),
      createDeferred<undefined>()
    ]
    let boundaryIndex = 0
    let inFlight = 0
    let maxInFlight = 0
    const yieldToHost = vi.fn(() => {
      const boundary = boundaries[boundaryIndex]
      if (!boundary) {
        throw new Error('Unexpected extra cooperative boundary')
      }
      boundaryIndex += 1
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      return boundary.promise.finally(() => {
        inFlight -= 1
      })
    })
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis, {
      yieldToHost
    })

    const execution = executePrepared(
      action,
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    await Promise.resolve()
    expect(apis.createCompositionGroup).not.toHaveBeenCalled()
    expect(apis.createCompositionElements).not.toHaveBeenCalled()

    boundaries[0].resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionGroup).toHaveBeenCalledOnce()
    )
    expect(apis.createCompositionElements).not.toHaveBeenCalled()

    boundaries[1].resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionElements).toHaveBeenCalledTimes(1)
    )
    expect(
      apis.createCompositionElements.mock.calls[0]?.[0].map(
        ({ id }: PreparedElementDescriptor) => id
      )
    ).toEqual(
      items
        .slice(0, PREPARED_DRAWING_SLICE_ELEMENT_BUDGET)
        .map(({ role }) => `${role}-id`)
    )
    expect(apis.createCompositionElements).toHaveBeenCalledTimes(1)
    expect(inFlight).toBe(1)

    boundaries[2].resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionElements).toHaveBeenCalledTimes(2)
    )
    expect(
      apis.createCompositionElements.mock.calls[1]?.[0].map(
        ({ id }: PreparedElementDescriptor) => id
      )
    ).toEqual(
      items
        .slice(
          PREPARED_DRAWING_SLICE_ELEMENT_BUDGET,
          PREPARED_DRAWING_SLICE_ELEMENT_BUDGET * 2
        )
        .map(({ role }) => `${role}-id`)
    )

    boundaries[3].resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionElements).toHaveBeenCalledTimes(3)
    )
    expect(
      apis.createCompositionElements.mock.calls[2]?.[0].map(
        ({ id }: PreparedElementDescriptor) => id
      )
    ).toEqual(
      items
        .slice(PREPARED_DRAWING_SLICE_ELEMENT_BUDGET * 2)
        .map(({ role }) => `${role}-id`)
    )

    boundaries[4].resolve(undefined)
    await expect(execution).resolves.toMatchObject({
      appliedElementIds: items.map(({ role }) => `${role}-id`),
      status: 'complete'
    })
    expect(maxInFlight).toBe(1)
    expect(inFlight).toBe(0)
    expect(yieldToHost).toHaveBeenCalledTimes(5)
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('uses fixed point-aware plural batch boundaries and preserves exact order', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 31 }, (_, index) =>
      vectorItemWithPointCount(1024, `detail-${index}`)
    )
    const orderedElementIds = items.map(({ role }) => `${role}-id`)
    const yieldToHost = vi.fn(async () => undefined)
    apis.createCompositionElements.mockImplementation(
      (batch: readonly PreparedElementDescriptor[]) =>
        canonicalElementIds(batch.map(({ id }) => id))
    )
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis, {
      yieldToHost
    })

    await executePrepared(
      action,
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(
      apis.createCompositionElements.mock.calls.map(([batch]) => batch.length)
    ).toEqual([...Array.from({ length: 15 }, () => 2), 1])
    expect(
      apis.createCompositionElements.mock.calls.flatMap(([batch]) =>
        batch.map(({ id }: PreparedElementDescriptor) => id)
      )
    ).toEqual(orderedElementIds)
    expect(yieldToHost).toHaveBeenCalledTimes(18)
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('uses a point-aware progressive soft budget without rejecting an intact over-target element', async () => {
    const items = [
      vectorItemWithPointCount(2591, 'detail-over-target'),
      vectorItemWithPointCount(1500, 'detail-1'),
      vectorItemWithPointCount(700, 'detail-2'),
      vectorItemWithPointCount(700, 'detail-3')
    ]
    const orderedElementIds = items.map(({ role }) => `${role}-id`)
    const progressiveApis = actionApis()
    progressiveApis.createCompositionElements.mockImplementation(
      (batch: readonly PreparedElementDescriptor[]) =>
        canonicalElementIds(batch.map(({ id }) => id))
    )
    const progressive = actionByName(
      AiActionNames.INSERT_VECTOR_COMPOSITION,
      progressiveApis,
      {
        yieldToHost: async () => undefined
      }
    )

    await executePrepared(
      progressive,
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(
      progressiveApis.createCompositionElements.mock.calls.map(([batch]) =>
        batch.map(({ id }: PreparedElementDescriptor) => id)
      )
    ).toEqual([
      [orderedElementIds[0]],
      [orderedElementIds[1]],
      orderedElementIds.slice(2)
    ])
    expect(PREPARED_DRAWING_SLICE_POINT_BUDGET).toBe(2048)
  })

  it('creates the canonical Group before ordered child slices without post-hoc regrouping', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      vectorItem(`fur-${index}`)
    )
    apis.createCompositionGroup.mockReturnValue('cat-group-id')
    apis.createCompositionElements.mockImplementation(
      (batch: readonly PreparedElementDescriptor[]) =>
        canonicalElementIds(batch.map(({ id }) => id))
    )
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)

    await executePrepared(
      action,
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(apis.createCompositionGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        height: 22,
        id: 'cat-group-id',
        type: 'group',
        width: 158,
        x: 472,
        y: 372
      }),
      mutationOptions
    )
    expect(
      apis.createCompositionGroup.mock.invocationCallOrder[0]
    ).toBeLessThan(apis.createCompositionElements.mock.invocationCallOrder[0])
    expect(apis.createCompositionElements).toHaveBeenCalledTimes(
      Math.ceil(items.length / PREPARED_DRAWING_SLICE_ELEMENT_BUDGET)
    )
    expect(
      apis.createCompositionElements.mock.calls.flatMap(([batch]) =>
        batch.map(({ id }) => id)
      )
    ).toEqual(items.map(({ role }) => `${role}-id`))
    expect(
      apis.createCompositionElements.mock.calls.every(
        ([, parent, options]) =>
          parent.id === 'cat-group-id' &&
          options.sharedDelivery === 'immediate' &&
          options.undoable === true
      )
    ).toBe(true)
  })

  it('creates ordinary grouped elements and returns detached role/id hints', async () => {
    const apis = actionApis()
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)
    const input = {
      compositionRole: 'cat-face',
      items: [ovalItem(), vectorItem()],
      parent: 'workspace'
    } as const
    const prepared = createServerPreparedCompositionArtifact(input)

    await expect(action.execute(prepared, executionContext())).resolves.toEqual(
      {
        action: AiActionNames.INSERT_VECTOR_COMPOSITION,
        appliedElementIds: ['left-eye-id', 'left-whisker-1-id'],
        compositionId: 'cat-group-id',
        roleToElementIds: prepared.roleToElementIds,
        skipped: [],
        status: 'complete'
      }
    )
    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      prepared.slices[0].descriptors,
      {
        id: 'cat-group-id'
      },
      mutationOptions
    )
  })

  it('aggregates canonical pupil ids without replacing their formal roles', async () => {
    const apis = actionApis()
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)

    await expect(
      executePrepared(
        action,
        {
          compositionRole: 'cat-face',
          items: [ovalItem('left-pupil'), ovalItem('right-pupil')],
          parent: 'workspace'
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      roleToElementIds: {
        'left-pupil': ['left-pupil-id'],
        'right-pupil': ['right-pupil-id'],
        pupils: ['left-pupil-id', 'right-pupil-id']
      },
      status: 'complete'
    })
  })

  it('skips a duplicate semantic role before mutation and resolves partial evidence', async () => {
    const apis = actionApis()
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)
    const descriptor = {
      compositionRole: 'cat-face',
      items: [
        ovalItem('face'),
        vectorItem('right-whisker-2'),
        vectorItem('right-whisker-2')
      ],
      parent: 'workspace'
    }
    const prepared = createServerPreparedCompositionArtifact(descriptor)

    expect(prepared).toMatchObject({
      groupBounds: {
        height: 94,
        width: 180,
        x: 472,
        y: 300
      },
      pointCount: 2,
      roleToElementIds: {
        face: ['face-id'],
        'right-whisker-2': ['right-whisker-2-id'],
        whiskers: ['right-whisker-2-id']
      },
      slices: [{ pointCount: 2, roles: ['face', 'right-whisker-2'] }],
      skipped: [
        {
          reason: 'duplicate-role',
          role: 'right-whisker-2'
        }
      ]
    })
    await expect(
      action.execute(prepared, executionContext())
    ).resolves.toMatchObject({
      appliedElementIds: ['face-id', 'right-whisker-2-id'],
      skipped: [
        {
          reason: 'duplicate-role',
          role: 'right-whisker-2'
        }
      ],
      status: 'partial'
    })
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      prepared.slices[0].descriptors,
      {
        id: 'cat-group-id'
      },
      mutationOptions
    )
  })

  it('revalidates update targets immediately before mutation and skips only missing items', async () => {
    const apis = actionApis()
    const reads = new Map<string, number>()
    apis.getElementType.mockImplementation((elementId: string) => {
      const count = (reads.get(elementId) ?? 0) + 1
      reads.set(elementId, count)
      if (elementId === 'eye-gone' && count > 1) {
        return undefined
      }
      return elementId.startsWith('eye') ? 'oval' : 'vector'
    })
    apis.getElementBounds.mockReturnValue({
      height: 50,
      width: 100,
      x: 200,
      y: 300
    })
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(AiActionNames.UPDATE_COMPOSITION_ELEMENTS, apis)

    await expect(
      executePrepared(
        action,
        {
          updates: [
            {
              elementId: 'eye-gone',
              geometry: {
                scaleX: 1.2,
                scaleY: 1.2
              }
            },
            {
              elementId: 'eye-present',
              geometry: {
                scaleX: 1.2,
                scaleY: 1.2
              }
            },
            {
              elementId: 'whisker-present',
              style: {
                strokeColor: '#2563EB'
              }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      appliedElementIds: ['eye-present', 'whisker-present'],
      skipped: [
        {
          elementId: 'eye-gone',
          reason: 'missing-target'
        }
      ],
      status: 'partial'
    })
    expect(apis.changeElementGeometry).toHaveBeenCalledOnce()
    expect(apis.changeElementGeometry).toHaveBeenCalledWith(
      'eye-present',
      {
        height: 60,
        width: 120,
        x: 190,
        y: 295
      },
      mutationOptions
    )
    expect(apis.updateElementStrokeColors).toHaveBeenCalledWith(
      [
        {
          color: '#2563EB',
          elementId: 'whisker-present'
        }
      ],
      mutationOptions
    )
    expect(apis.updateElementStrokeColor).not.toHaveBeenCalled()
  })

  it('applies one ordered progressive style batch before yielding once', async () => {
    const apis = actionApis()
    const yieldToHost = vi.fn(async () => undefined)
    apis.getElementType.mockReturnValue('vector')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        yieldToHost
      }
    )

    await expect(
      executePrepared(
        action,
        {
          updates: [
            {
              elementId: 'whisker-left',
              style: { strokeColor: '#2563EB' }
            },
            {
              elementId: 'whisker-right',
              style: { strokeColor: '#2563EB' }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      appliedElementIds: ['whisker-left', 'whisker-right'],
      status: 'complete'
    })
    expect(apis.updateElementStrokeColors).toHaveBeenCalledOnce()
    expect(apis.updateElementStrokeColors).toHaveBeenCalledWith(
      [
        {
          color: '#2563EB',
          elementId: 'whisker-left'
        },
        {
          color: '#2563EB',
          elementId: 'whisker-right'
        }
      ],
      mutationOptions
    )
    expect(apis.updateElementStrokeColor).not.toHaveBeenCalled()
    expect(yieldToHost).toHaveBeenCalledOnce()
  })

  it('bounds progressive style batches at 256 items without reordering', async () => {
    const apis = actionApis()
    const yieldToHost = vi.fn(async () => undefined)
    const updates = Array.from({ length: 513 }, (_, index) => ({
      elementId: `whisker-${index}`,
      style: { strokeColor: '#2563EB' }
    }))
    apis.getElementType.mockReturnValue('vector')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        yieldToHost
      }
    )

    await expect(
      executePrepared(action, { updates }, executionContext())
    ).resolves.toMatchObject({
      appliedElementIds: updates.map(({ elementId }) => elementId),
      status: 'complete'
    })
    expect(
      apis.updateElementStrokeColors.mock.calls.map(([batch]) => batch.length)
    ).toEqual([256, 256, 1])
    expect(
      apis.updateElementStrokeColors.mock.calls.flatMap(([batch]) =>
        batch.map(({ elementId }) => elementId)
      )
    ).toEqual(updates.map(({ elementId }) => elementId))
    expect(apis.updateElementStrokeColor).not.toHaveBeenCalled()
    expect(yieldToHost).toHaveBeenCalledTimes(3)
  })

  it('stops before the next progressive style batch after cancellation', async () => {
    const apis = actionApis()
    const controller = new AbortController()
    const yieldToHost = vi.fn(async () => {
      controller.abort()
    })
    const updates = Array.from({ length: 257 }, (_, index) => ({
      elementId: `whisker-${index}`,
      style: { strokeColor: '#2563EB' }
    }))
    apis.getElementType.mockReturnValue('vector')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        yieldToHost
      }
    )

    await expect(
      executePrepared(action, { updates }, { signal: controller.signal })
    ).rejects.toBeInstanceOf(AiActionError)
    expect(apis.updateElementStrokeColors).toHaveBeenCalledOnce()
    expect(apis.updateElementStrokeColors.mock.calls[0]?.[0]).toHaveLength(256)
    expect(apis.updateElementStrokeColor).not.toHaveBeenCalled()
    expect(yieldToHost).toHaveBeenCalledOnce()
  })

  it('aligns applied and no-change outcomes from a style batch', async () => {
    const apis = actionApis()
    apis.getElementType.mockReturnValue('vector')
    apis.getElementFillColor.mockReturnValue('#050504')
    apis.updateElementFillColors.mockReturnValue([true, false, true])
    const action = actionByName(AiActionNames.UPDATE_COMPOSITION_ELEMENTS, apis)

    await expect(
      executePrepared(
        action,
        {
          updates: ['left', 'middle', 'right'].map((suffix) => ({
            elementId: `pupil-${suffix}`,
            style: { fillColor: '#DC2626' }
          }))
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      appliedElementIds: ['pupil-left', 'pupil-right'],
      skipped: [
        {
          elementId: 'pupil-middle',
          reason: 'no-change'
        }
      ],
      status: 'partial'
    })
  })

  it('rejects a style batch result that is not index-aligned', async () => {
    const apis = actionApis()
    apis.getElementType.mockReturnValue('vector')
    apis.getElementFillColor.mockReturnValue('#050504')
    apis.updateElementFillColors.mockReturnValue([true])
    const action = actionByName(AiActionNames.UPDATE_COMPOSITION_ELEMENTS, apis)

    await expect(
      executePrepared(
        action,
        {
          updates: [
            {
              elementId: 'pupil-left',
              style: { fillColor: '#DC2626' }
            },
            {
              elementId: 'pupil-right',
              style: { fillColor: '#DC2626' }
            }
          ]
        },
        executionContext()
      )
    ).rejects.toThrow(
      'AI composition style batch did not preserve the requested item count.'
    )
  })

  it('preserves contiguous fill and stroke batch order', async () => {
    const apis = actionApis()
    const yieldToHost = vi.fn(async () => undefined)
    apis.getElementType.mockReturnValue('vector')
    apis.getElementFillColor.mockReturnValue('#050504')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        yieldToHost
      }
    )

    await expect(
      executePrepared(
        action,
        {
          updates: [
            {
              elementId: 'pupil-left',
              style: { fillColor: '#DC2626' }
            },
            {
              elementId: 'whisker-left',
              style: { strokeColor: '#2563EB' }
            },
            {
              elementId: 'pupil-right',
              style: { fillColor: '#DC2626' }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      appliedElementIds: ['pupil-left', 'whisker-left', 'pupil-right'],
      status: 'complete'
    })
    expect(apis.updateElementFillColors).toHaveBeenCalledTimes(2)
    expect(apis.updateElementStrokeColors).toHaveBeenCalledOnce()
    expect(
      apis.updateElementFillColors.mock.invocationCallOrder[0]
    ).toBeLessThan(apis.updateElementStrokeColors.mock.invocationCallOrder[0])
    expect(
      apis.updateElementStrokeColors.mock.invocationCallOrder[0]
    ).toBeLessThan(apis.updateElementFillColors.mock.invocationCallOrder[1])
    expect(yieldToHost).toHaveBeenCalledTimes(3)
  })

  it('rejects a progressive update when cancellation arrives during its final host yield', async () => {
    const apis = actionApis()
    const controller = new AbortController()
    const yieldToHost = vi.fn(async () => {
      controller.abort()
    })
    apis.getElementType.mockReturnValue('vector')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        yieldToHost
      }
    )

    await expect(
      executePrepared(
        action,
        {
          updates: [
            {
              elementId: 'whisker-left',
              style: { strokeColor: '#2563EB' }
            }
          ]
        },
        { signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(AiActionError)
    expect(apis.updateElementStrokeColors).toHaveBeenCalledOnce()
    expect(apis.updateElementStrokeColor).not.toHaveBeenCalled()
    expect(yieldToHost).toHaveBeenCalledOnce()
  })

  it('scales existing vector eye topology without regenerating composition elements', async () => {
    const apis = actionApis()
    apis.getElementType.mockReturnValue('vector')
    const action = actionByName(AiActionNames.UPDATE_COMPOSITION_ELEMENTS, apis)

    await expect(
      executePrepared(
        action,
        {
          updates: [
            {
              elementId: 'vector-eye-left',
              geometry: {
                scaleX: 1.2,
                scaleY: 1.2
              }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      appliedElementIds: ['vector-eye-left'],
      skipped: [],
      status: 'complete'
    })
    expect(apis.scaleVectorElementGeometry).toHaveBeenCalledWith(
      'vector-eye-left',
      {
        scaleX: 1.2,
        scaleY: 1.2
      },
      mutationOptions
    )
    expect(apis.changeElementGeometry).not.toHaveBeenCalled()
    expect(apis.createCompositionElements).not.toHaveBeenCalled()
    expect(apis.removeSubtree).not.toHaveBeenCalled()
  })

  it('updates only existing pupil fills through the canonical fill boundary', async () => {
    const apis = actionApis()
    apis.getElementType.mockReturnValue('vector')
    apis.getElementFillColor.mockReturnValue('#050504')
    const action = actionByName(AiActionNames.UPDATE_COMPOSITION_ELEMENTS, apis)

    await expect(
      executePrepared(
        action,
        {
          updates: [
            {
              elementId: 'pupil-left',
              style: {
                fillColor: '#DC2626'
              }
            },
            {
              elementId: 'pupil-right',
              style: {
                fillColor: '#DC2626'
              }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      appliedElementIds: ['pupil-left', 'pupil-right'],
      skipped: [],
      status: 'complete'
    })
    expect(apis.updateElementFillColors).toHaveBeenCalledOnce()
    expect(apis.updateElementFillColors).toHaveBeenCalledWith(
      [
        {
          color: '#DC2626',
          elementId: 'pupil-left'
        },
        {
          color: '#DC2626',
          elementId: 'pupil-right'
        }
      ],
      mutationOptions
    )
    expect(apis.updateElementFillColor).not.toHaveBeenCalled()
    expect(apis.createCompositionElements).not.toHaveBeenCalled()
    expect(apis.removeSubtree).not.toHaveBeenCalled()
  })

  it('skips a missing pupil fill while committing the valid sibling as partial', async () => {
    const apis = actionApis()
    apis.getElementType.mockReturnValue('vector')
    apis.getElementFillColor.mockImplementation((elementId: string) =>
      elementId === 'pupil-left' ? null : '#050504'
    )
    const action = actionByName(AiActionNames.UPDATE_COMPOSITION_ELEMENTS, apis)

    await expect(
      executePrepared(
        action,
        {
          updates: [
            {
              elementId: 'pupil-left',
              style: {
                fillColor: '#DC2626'
              }
            },
            {
              elementId: 'pupil-right',
              style: {
                fillColor: '#DC2626'
              }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      appliedElementIds: ['pupil-right'],
      skipped: [
        {
          elementId: 'pupil-left',
          reason: 'missing-fill'
        }
      ],
      status: 'partial'
    })
    expect(apis.updateElementFillColors).toHaveBeenCalledOnce()
    expect(apis.updateElementFillColors).toHaveBeenCalledWith(
      [
        {
          color: '#DC2626',
          elementId: 'pupil-right'
        }
      ],
      mutationOptions
    )
    expect(apis.updateElementFillColor).not.toHaveBeenCalled()
  })

  it('returns no-change for a missing removal target and removes an existing Group once', async () => {
    const missingApis = actionApis()
    missingApis.getElementType.mockReturnValue(undefined)
    const missing = actionByName(
      AiActionNames.REMOVE_AI_COMPOSITION,
      missingApis
    )

    await expect(
      executePrepared(
        missing,
        {
          compositionId: 'gone-group'
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AiActionNames.REMOVE_AI_COMPOSITION,
      appliedElementIds: [],
      skipped: [
        {
          elementId: 'gone-group',
          reason: 'missing-target'
        }
      ],
      status: 'no-change'
    })
    expect(missingApis.removeSubtree).not.toHaveBeenCalled()

    const existingApis = actionApis()
    existingApis.getElementType.mockReturnValue('group')
    existingApis.removeSubtree.mockReturnValue({
      removed: ['cat-group', 'face-id'],
      rootId: 'cat-group'
    })
    const existing = actionByName(
      AiActionNames.REMOVE_AI_COMPOSITION,
      existingApis
    )

    await expect(
      executePrepared(
        existing,
        {
          compositionId: 'cat-group'
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      appliedElementIds: ['cat-group', 'face-id'],
      status: 'complete'
    })
    expect(existingApis.getElementType).toHaveBeenCalledTimes(2)
    expect(existingApis.removeSubtree).toHaveBeenCalledWith(
      'cat-group',
      mutationOptions
    )
  })

  it('rejects a pre-aborted insert before requesting Group or child mutation', async () => {
    const apis = actionApis()
    const controller = new AbortController()
    controller.abort()
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)

    await expect(
      executePrepared(
        action,
        {
          compositionRole: 'cat-face',
          items: [ovalItem('face'), vectorItem()],
          parent: 'workspace'
        },
        { signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(AiActionError)
    expect(apis.setDrawingProgress).not.toHaveBeenCalled()
    expect(apis.createCompositionGroup).not.toHaveBeenCalled()
    expect(apis.createCompositionElements).not.toHaveBeenCalled()
  })

  it('rejects a null canonical child result as fatal', async () => {
    const apis = actionApis()
    apis.createCompositionElements.mockReturnValue(null)
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)

    await expect(
      executePrepared(
        action,
        {
          compositionRole: 'cat-face',
          items: [ovalItem('face'), vectorItem()],
          parent: 'workspace'
        },
        executionContext()
      )
    ).rejects.toThrow(
      'AI composition batch did not preserve its ordered canonical ids.'
    )
    expect(apis.createCompositionGroup).toHaveBeenCalledOnce()
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('rejects canonical child result cardinality mismatch as fatal', async () => {
    const apis = actionApis()
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(['face-id'])
    )
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)

    await expect(
      executePrepared(
        action,
        {
          compositionRole: 'cat-face',
          items: [ovalItem('face'), vectorItem()],
          parent: 'workspace'
        },
        executionContext()
      )
    ).rejects.toThrow(
      'AI composition batch did not preserve its ordered canonical ids.'
    )
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('reports only the completed prefix before a later progressive batch fails and clears progress', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 6 }, (_, index) =>
      vectorItemWithPointCount(1024, `detail-${index}`)
    )
    apis.createCompositionElements
      .mockImplementationOnce((batch: readonly PreparedElementDescriptor[]) =>
        canonicalElementIds(batch.map(({ id }) => id))
      )
      .mockReturnValueOnce(null)
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis, {
      yieldToHost: async () => undefined
    })

    await expect(
      executePrepared(
        action,
        {
          compositionRole: 'cat-face',
          items,
          parent: 'workspace'
        },
        executionContext()
      )
    ).rejects.toThrow(
      'AI composition batch did not preserve its ordered canonical ids.'
    )

    expect(apis.createCompositionElements).toHaveBeenCalledTimes(2)
    expect(
      apis.setDrawingProgress.mock.calls
        .map(([state]) => state)
        .filter((state) => state?.phase === 'drawing')
        .map(({ completedElements }) => completedElements)
    ).toEqual([2])
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('stops before the next progressive canonical batch after cancellation and clears progress', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 6 }, (_, index) =>
      vectorItemWithPointCount(1024, `detail-${index}`)
    )
    apis.createCompositionElements.mockImplementation(
      (batch: readonly PreparedElementDescriptor[]) =>
        canonicalElementIds(batch.map(({ id }) => id))
    )
    const controller = new AbortController()
    let yieldCount = 0
    const yieldToHost = vi.fn(async () => {
      yieldCount += 1
      if (yieldCount === 3) {
        controller.abort()
      }
    })
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis, {
      yieldToHost
    })

    await expect(
      executePrepared(
        action,
        {
          compositionRole: 'cat-face',
          items,
          parent: 'workspace'
        },
        { signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(AiActionError)
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(
      apis.createCompositionElements.mock.calls[0]?.[0].map(
        ({ id }: PreparedElementDescriptor) => id
      )
    ).toEqual(['detail-0-id', 'detail-1-id'])
    expect(yieldToHost).toHaveBeenCalledTimes(3)
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('propagates canonical common-API rejection as fatal without accepted partial evidence', async () => {
    const apis = actionApis()
    const failure = new Error('canonical creation failed')
    apis.createCompositionElements.mockImplementationOnce(() => {
      throw failure
    })
    const action = actionByName(AiActionNames.INSERT_VECTOR_COMPOSITION, apis)

    await expect(
      executePrepared(
        action,
        {
          compositionRole: 'cat-face',
          items: [ovalItem('face'), vectorItem()],
          parent: 'workspace'
        },
        executionContext()
      )
    ).rejects.toBe(failure)
  })
})
