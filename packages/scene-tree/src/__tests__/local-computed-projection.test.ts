import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import propsManager, {
  BasePropertyComponent,
  createPropertyComponentFromConfig,
  propertyComponentRegistry,
  registerPropertyComponent
} from '@asyra/props-manager'
import {
  EventTypes,
  subscribeToEventBatches,
  subscribeToEvents,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import {
  EntityTypes,
  PropertyTypes,
  SCENE_TREE_ACTIONS,
  resetIdCounter,
  type ComputedAttrs,
  type ComputedDataPatch,
  type DataTypes,
  type ElementInstanceTypes,
  type ElementRawData,
  type PropertyComponentRawData,
  type Unit
} from '@asyra/utils'
import sceneTree, { type SceneTree } from '../sceneTree'
import componentRegistry from '../component-registry'
import Element from '../components/element'
import { createDynamicComponent } from '../create-dynamic-component'
import { initSceneTreeSubscribes } from '../subscribes'

const LOCAL_COMPUTED_ELEMENT_TYPE = 'local-computed-projection-element'
const SHARED_PROJECTION_ROOT_TYPE = 'shared-projection-root'
const SHARED_PROJECTION_ELEMENT_TYPE = 'shared-projection-element'

const positionDefinition = {
  type: PropertyTypes.POSITION,
  defaults: { x: 0, y: 0 },
  persistKeys: ['x', 'y'],
  valueKeys: ['x', 'y']
}

const dimensionDefinition = {
  type: PropertyTypes.DIMENSION,
  defaults: { width: 100, height: 100 },
  persistKeys: ['width', 'height'],
  valueKeys: ['width', 'height']
}

class LocalComputedElement extends Element {
  static readonly ordinaryPropertyDefinitions = Object.freeze([
    Object.freeze({
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION
    }),
    Object.freeze({
      name: PropertyTypes.DIMENSION,
      type: PropertyTypes.DIMENSION
    })
  ])

  _init(): void {
    super._init()
    this.data.type = LOCAL_COMPUTED_ELEMENT_TYPE
  }
}

interface SharedProjectionRootData {
  id: string
  type: string
  children: string[]
}

class SharedProjectionRootComponent extends BasePropertyComponent<SharedProjectionRootData> {
  data: SharedProjectionRootData = {
    id: '',
    type: SHARED_PROJECTION_ROOT_TYPE,
    children: []
  }

  constructor(data: Partial<SharedProjectionRootData>) {
    super()
    this.load(data)
  }

  load(data: Partial<SharedProjectionRootData>): void {
    this.data = {
      ...this.data,
      ...data,
      type: SHARED_PROJECTION_ROOT_TYPE,
      children: [...(data.children ?? this.data.children)]
    }
  }

  save(): PropertyComponentRawData {
    return {
      ...super.save(),
      children: [...this.data.children]
    } as PropertyComponentRawData
  }

  getValue(): Record<string, DataTypes> {
    const child = this.propertyComponentAccessor.getPropertyById(
      this.data.children[0] ?? ''
    )
    return child?.getValue() ?? {}
  }

  getUnit(): Record<string, Unit> {
    return {}
  }
}

interface LocalComputedValueRequest {
  readonly elementId: string
  readonly values: Readonly<Partial<ComputedAttrs>>
}

interface LocalComputedPatchRequest {
  readonly elementId: string
  readonly patch: ComputedDataPatch
}

type LocalComputedSceneTree = SceneTree & {
  updateLocalComputedData(requests: readonly LocalComputedValueRequest[]): void
  patchLocalComputedData(requests: readonly LocalComputedPatchRequest[]): void
}

interface TestSubscription {
  unsubscribe(): void
}

const subscriptions: TestSubscription[] = []

const isComputedProjectionEvent = (event: { type: EventTypes }): boolean =>
  event.type === EventTypes.UPDATE_COMPUTED_DATA ||
  event.type === EventTypes.UPDATE_COMPUTED_DATA_PATCH

const createElement = (
  id: string,
  props?: ElementRawData['props']
): ElementInstanceTypes => {
  const element = sceneTree.createElement(
    {
      id,
      type: LOCAL_COMPUTED_ELEMENT_TYPE,
      ...(props ? { props } : {})
    },
    false
  )
  if (!element) {
    throw new Error(`Expected local computed fixture "${id}"`)
  }
  sceneTree.addToMap(element)
  return element
}

initSceneTreeSubscribes()

describe('SceneTree local computed projection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetIdCounter()
    sceneTree.reset()
    propsManager.reset()
    propertyComponentRegistry.clear()
    componentRegistry.getAll().forEach((_, type) => {
      componentRegistry.unregister(type)
    })

    registerPropertyComponent(
      PropertyTypes.POSITION,
      createPropertyComponentFromConfig(positionDefinition),
      undefined,
      positionDefinition
    )
    registerPropertyComponent(
      PropertyTypes.DIMENSION,
      createPropertyComponentFromConfig(dimensionDefinition),
      undefined,
      dimensionDefinition
    )
    componentRegistry.register({
      type: LOCAL_COMPUTED_ELEMENT_TYPE,
      idPrefix: LOCAL_COMPUTED_ELEMENT_TYPE,
      namePrefix: 'Local Computed Projection Element',
      constructor: LocalComputedElement,
      properties: [
        {
          name: PropertyTypes.POSITION,
          type: PropertyTypes.POSITION
        },
        {
          name: PropertyTypes.DIMENSION,
          type: PropertyTypes.DIMENSION
        }
      ],
      defaults: {}
    })
    sceneTree.init()
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
  })

  afterEach(() => {
    subscriptions.splice(0).forEach((subscription) => {
      subscription.unsubscribe()
    })
  })

  it('updates only computed state and publishes one ordered ordinary values batch', () => {
    const first = createElement('local-values-first')
    const second = createElement('local-values-second')
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const propsBefore = propsManager.save()
    const computedBatches: unknown[][] = []
    subscriptions.push(
      subscribeToEventBatches((events) => {
        const computedEvents = events.filter(isComputedProjectionEvent)
        if (computedEvents.length > 0) {
          computedBatches.push(computedEvents)
        }
      })
    )
    ;(sceneTree as LocalComputedSceneTree).updateLocalComputedData([
      {
        elementId: second.get('id'),
        values: { y: 24 }
      },
      {
        elementId: first.get('id'),
        values: { x: 12, width: 140 }
      }
    ])

    expect(second.computed.get('y')).toBe(24)
    expect(first.computed.get('x')).toBe(12)
    expect(first.computed.get('width')).toBe(140)
    expect(propsManager.save()).toEqual(propsBefore)
    expect(sceneTree.changes).toEqual([])
    expect(computedBatches).toEqual([
      [
        expect.objectContaining({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: expect.objectContaining({
            action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
            eventName: EventTypes.UPDATE_COMPUTED_DATA,
            id: 'local-values-second',
            changes: [
              {
                owner: 'computed',
                key: 'y',
                before: 0,
                after: 24
              }
            ]
          })
        }),
        expect.objectContaining({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: expect.objectContaining({
            action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
            eventName: EventTypes.UPDATE_COMPUTED_DATA,
            id: 'local-values-first',
            changes: [
              {
                owner: 'computed',
                key: 'x',
                before: 0,
                after: 12
              },
              {
                owner: 'computed',
                key: 'width',
                before: 100,
                after: 140
              }
            ]
          })
        })
      ]
    ])

    computedBatches.length = 0
    ;(sceneTree as LocalComputedSceneTree).updateLocalComputedData([
      {
        elementId: second.get('id'),
        values: { y: 24 }
      },
      {
        elementId: first.get('id'),
        values: { x: 12, width: 140 }
      }
    ])

    expect(computedBatches).toEqual([])
    expect(propsManager.save()).toEqual(propsBefore)
    expect(sceneTree.changes).toEqual([])
  })

  it('preflights the complete local patch batch before applying any prefix', () => {
    const first = createElement('local-patch-first')
    createElement('local-patch-second')
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const propsBefore = propsManager.save()
    const computedBatches: unknown[][] = []
    subscriptions.push(
      subscribeToEventBatches((events) => {
        const computedEvents = events.filter(isComputedProjectionEvent)
        if (computedEvents.length > 0) {
          computedBatches.push(computedEvents)
        }
      })
    )

    expect(() =>
      (sceneTree as LocalComputedSceneTree).patchLocalComputedData([
        {
          elementId: first.get('id'),
          patch: {
            values: { width: 180 }
          }
        },
        {
          elementId: 'missing-local-patch-element',
          patch: {
            values: { width: 220 }
          }
        }
      ])
    ).toThrow(/missing.*element/i)

    expect(first.computed.get('width')).toBe(100)
    expect(propsManager.save()).toEqual(propsBefore)
    expect(sceneTree.changes).toEqual([])
    expect(computedBatches).toEqual([])
  })

  it('fans one canonical property batch out to every related element without shared computed evidence', () => {
    const sharedPosition = propsManager.createProperty({
      id: 'shared-position',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0
    })
    const firstDimension = propsManager.createProperty({
      id: 'shared-first-dimension',
      type: PropertyTypes.DIMENSION,
      width: 100,
      height: 100
    })
    const secondDimension = propsManager.createProperty({
      id: 'shared-second-dimension',
      type: PropertyTypes.DIMENSION,
      width: 100,
      height: 100
    })
    propsManager.addProperty([sharedPosition, firstDimension, secondDimension])
    const first = createElement('shared-owner-first', {
      [PropertyTypes.POSITION]: sharedPosition.get('id'),
      [PropertyTypes.DIMENSION]: firstDimension.get('id')
    } as ElementRawData['props'])
    const second = createElement('shared-owner-second', {
      [PropertyTypes.POSITION]: sharedPosition.get('id'),
      [PropertyTypes.DIMENSION]: secondDimension.get('id')
    } as ElementRawData['props'])
    sceneTree.cleanChanges()
    propsManager.cleanChanges()

    expect(
      sceneTree
        .getElementPropertyRelations(sharedPosition.get('id'))
        .map(({ ownerElementId }) => ownerElementId)
    ).toEqual(['shared-owner-first', 'shared-owner-second'])

    const computedBatches: unknown[][] = []
    const transactionEvents: UpdateTransactionEvent[] = []
    subscriptions.push(
      subscribeToEventBatches((events) => {
        const computedEvents = events.filter(isComputedProjectionEvent)
        if (computedEvents.length > 0) {
          computedBatches.push(computedEvents)
        }
      }),
      subscribeToEvents((event) => {
        if (event.type === EventTypes.UPDATE_TRANSACTION) {
          transactionEvents.push(event as UpdateTransactionEvent)
        }
      })
    )
    transactionEvents.length = 0

    propsManager.updatePropertyById(sharedPosition.get('id'), 'x', 48)
    propsManager.commitChanges()

    expect(first.computed.get('x')).toBe(48)
    expect(second.computed.get('x')).toBe(48)
    expect(computedBatches).toEqual([
      [
        expect.objectContaining({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: expect.objectContaining({
            id: 'shared-owner-first'
          })
        }),
        expect.objectContaining({
          type: EventTypes.UPDATE_COMPUTED_DATA,
          payload: expect.objectContaining({
            id: 'shared-owner-second'
          })
        })
      ]
    ])
    expect(
      transactionEvents.filter(({ payload }) => {
        const action = (
          payload as {
            action?: string
          }
        ).action
        return (
          action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA ||
          action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH ||
          action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH
        )
      })
    ).toEqual([])
  })

  it('projects one shared child update through Props ancestors to every Scene root relation', () => {
    const rootDefinition = {
      type: SHARED_PROJECTION_ROOT_TYPE,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    registerPropertyComponent(
      SHARED_PROJECTION_ROOT_TYPE,
      SharedProjectionRootComponent,
      undefined,
      rootDefinition
    )
    componentRegistry.register({
      type: SHARED_PROJECTION_ELEMENT_TYPE,
      idPrefix: SHARED_PROJECTION_ELEMENT_TYPE,
      namePrefix: 'Shared Projection Element',
      constructor: createDynamicComponent(
        SHARED_PROJECTION_ELEMENT_TYPE,
        SHARED_PROJECTION_ELEMENT_TYPE,
        'Shared Projection Element',
        [
          {
            name: 'shared',
            type: SHARED_PROJECTION_ROOT_TYPE
          }
        ],
        {}
      ),
      properties: [
        {
          name: 'shared',
          type: SHARED_PROJECTION_ROOT_TYPE
        }
      ],
      defaults: {}
    })

    const child = propsManager.createProperty({
      id: 'shared-projection-child',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 0
    })
    const firstRoot = propsManager.createProperty({
      id: 'shared-projection-root-a',
      type: SHARED_PROJECTION_ROOT_TYPE,
      children: [child.get('id')]
    })
    const secondRoot = propsManager.createProperty({
      id: 'shared-projection-root-b',
      type: SHARED_PROJECTION_ROOT_TYPE,
      children: [child.get('id')]
    })
    propsManager.addProperty([child, firstRoot, secondRoot])

    const createSharedElement = (
      id: string,
      rootPropertyId: string
    ): ElementInstanceTypes => {
      const element = sceneTree.createElement(
        {
          id,
          type: SHARED_PROJECTION_ELEMENT_TYPE,
          props: {
            shared: rootPropertyId
          } as unknown as ElementRawData['props']
        },
        false
      )
      if (!element) {
        throw new Error(`Expected shared projection fixture "${id}"`)
      }
      sceneTree.addToMap(element)
      return element
    }
    const first = createSharedElement(
      'shared-projection-owner-a',
      firstRoot.get('id')
    )
    const second = createSharedElement(
      'shared-projection-owner-b',
      secondRoot.get('id')
    )
    sceneTree.cleanChanges()
    propsManager.cleanChanges()

    const computedBatches: unknown[][] = []
    subscriptions.push(
      subscribeToEventBatches((events) => {
        const computedEvents = events.filter(isComputedProjectionEvent)
        if (computedEvents.length > 0) {
          computedBatches.push(computedEvents)
        }
      })
    )

    expect(propsManager.resolvePropertyAncestorIds([child.get('id')])).toEqual([
      'shared-projection-child',
      'shared-projection-root-a',
      'shared-projection-root-b'
    ])
    expect(
      sceneTree
        .getElementPropertyRelations(firstRoot.get('id'))
        .map(({ ownerElementId }) => ownerElementId)
    ).toEqual(['shared-projection-owner-a'])
    expect(
      sceneTree
        .getElementPropertyRelations(secondRoot.get('id'))
        .map(({ ownerElementId }) => ownerElementId)
    ).toEqual(['shared-projection-owner-b'])

    propsManager.updatePropertyById(child.get('id'), 'x', 73)
    expect(firstRoot.getValue()).toMatchObject({ x: 73 })
    expect(secondRoot.getValue()).toMatchObject({ x: 73 })
    propsManager.commitChanges()

    expect(first.computed.get('x')).toBe(73)
    expect(second.computed.get('x')).toBe(73)
    expect(
      computedBatches[0]?.map(
        (event) =>
          (
            event as {
              payload: { id: string }
            }
          ).payload.id
      )
    ).toEqual(['shared-projection-owner-a', 'shared-projection-owner-b'])
    expect(computedBatches).toHaveLength(1)
    expect(sceneTree.changes).toEqual([])
  })

  it('reprojects canonical load through the ordered local route after replacing Scene relations', () => {
    const workspaceId = 'canonical-load-workspace'
    const elementId = 'canonical-load-element'
    const position = propsManager.createProperty({
      id: 'canonical-load-position',
      type: PropertyTypes.POSITION,
      x: 31,
      y: 47
    })
    const dimension = propsManager.createProperty({
      id: 'canonical-load-dimension',
      type: PropertyTypes.DIMENSION,
      width: 180,
      height: 96
    })
    propsManager.addProperty([position, dimension])
    propsManager.cleanChanges()
    const propsBefore = propsManager.save()
    const transactionEvents: UpdateTransactionEvent[] = []
    subscriptions.push(
      subscribeToEvents((event) => {
        if (event.type === EventTypes.UPDATE_TRANSACTION) {
          transactionEvents.push(event as UpdateTransactionEvent)
        }
      })
    )

    const originalProject =
      sceneTree.projectLocalComputedDataFromPropertyIds.bind(sceneTree)
    const projectionObservations: {
      propertyIds: readonly string[]
      activeElementId?: string
      relationOwnerIds: readonly (readonly string[])[]
    }[] = []
    const projectionSpy = vi
      .spyOn(sceneTree, 'projectLocalComputedDataFromPropertyIds')
      .mockImplementation((propertyIds) => {
        projectionObservations.push({
          propertyIds: [...propertyIds],
          activeElementId: sceneTree.getElementById(elementId)?.get('id'),
          relationOwnerIds: propertyIds.map((propertyId) =>
            sceneTree
              .getElementPropertyRelations(propertyId)
              .map(({ ownerElementId }) => ownerElementId)
          )
        })
        originalProject(propertyIds)
      })

    try {
      sceneTree.load({
        workspace: workspaceId,
        workspaceList: [workspaceId],
        elements: {
          [workspaceId]: {
            id: workspaceId,
            type: EntityTypes.WORKSPACE,
            name: 'Canonical Load Workspace',
            parentId: '',
            visible: true,
            lock: false,
            children: [elementId]
          },
          [elementId]: {
            id: elementId,
            type: LOCAL_COMPUTED_ELEMENT_TYPE,
            name: 'Canonical Load Element',
            parentId: workspaceId,
            visible: true,
            lock: false,
            props: {
              [PropertyTypes.POSITION]: position.get('id'),
              [PropertyTypes.DIMENSION]: dimension.get('id')
            }
          }
        }
      })
    } finally {
      projectionSpy.mockRestore()
    }

    const loadedElement = sceneTree.getElementById(elementId)
    expect(loadedElement?.computed.get('x')).toBe(31)
    expect(loadedElement?.computed.get('y')).toBe(47)
    expect(loadedElement?.computed.get('width')).toBe(180)
    expect(loadedElement?.computed.get('height')).toBe(96)
    expect(propsManager.save()).toEqual(propsBefore)
    expect(sceneTree.changes).toEqual([])
    expect(
      transactionEvents.filter(({ payload }) => {
        const action = (payload as { action?: string }).action
        return (
          action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA ||
          action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH ||
          action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH
        )
      })
    ).toEqual([])
    expect(projectionObservations).toEqual([
      {
        propertyIds: [dimension.get('id'), position.get('id')],
        activeElementId: elementId,
        relationOwnerIds: [[elementId], [elementId]]
      }
    ])
  })
})
