import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  endTransaction,
  EventTypes,
  publishEvent,
  runInTransactionReplayMode,
  startTransaction,
  subscribeToEvents
} from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  type AddRemovePropertyChange,
  type PropertyComponentRawData,
  PropertyTypes,
  Unit,
  type PropsChange
} from '@asyra/utils'
import propsManager from '..'
import { getPropertyComponentAccessor } from '../manager/component-accessor'
import {
  propertyComponentRegistry,
  registerPropertyComponent
} from '../registries/property-component'
import {
  propertySchemaRegistry,
  registerPropertySchema
} from '../registries/property-schema'
import { createPropertyComponentFromConfig } from '../registries/declarative-property-type'
import { PositionComponent } from './helpers/test-property-components'

const NESTED_PARENT_TYPE = 'subscriber-nested-parent'
const nestedParentDefinition = {
  type: NESTED_PARENT_TYPE,
  defaults: { children: [] as string[] },
  persistKeys: ['children'],
  valueKeys: ['children'],
  children: {
    key: 'children',
    childType: PropertyTypes.POSITION,
    mode: 'ids-or-objects' as const,
    toChildData: (item: Record<string, unknown>) => item
  }
}
const NestedParentComponent = createPropertyComponentFromConfig(
  nestedParentDefinition
)

describe('props-manager subscribes', () => {
  beforeEach(() => {
    propsManager.reset()
    propertyComponentRegistry.clear()
    propertySchemaRegistry.clear()
    registerPropertyComponent(PropertyTypes.POSITION, PositionComponent)
    registerPropertyComponent(
      NESTED_PARENT_TYPE,
      NestedParentComponent,
      undefined,
      nestedParentDefinition
    )
  })

  it('clears pending property changes on endTransaction', () => {
    startTransaction()
    const pendingChange = {
      action: 'updateProperty',
      eventName: EventTypes.UPDATE_PROPERTY,
      id: 'pp-1',
      key: 'x',
      before: 0,
      after: 10
    } as PropsChange
    propsManager.addChange(pendingChange)

    expect(propsManager.changes).toHaveLength(1)

    endTransaction()

    expect(propsManager.changes).toHaveLength(0)
  })

  it('keeps one fresh ADD_PROPERTY payload as one ordered canonical change', () => {
    const source = [
      new PositionComponent({
        id: 'batch-position-first',
        type: PropertyTypes.POSITION,
        x: 10,
        y: 20,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }).save(),
      new PositionComponent({
        id: 'batch-position-second',
        type: PropertyTypes.POSITION,
        x: 30,
        y: 40,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }).save()
    ]
    const committedChanges: PropsChange[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        committedChanges.push(
          (event as unknown as { payload: PropsChange }).payload
        )
      }
    })
    const originalCommitChanges = propsManager.commitChanges
    const pendingChangeCounts: number[] = []
    const phaseNames: string[] = []
    const applyPropertyCreationBatch = vi.spyOn(
      propsManager,
      'applyPropertyCreationBatch'
    )
    const createProperty = vi.spyOn(propsManager, 'createProperty')
    const addProperty = vi.spyOn(propsManager, 'addProperty')
    const addToMap = vi.spyOn(propsManager, 'addToMap')
    const runtime = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previousSink = runtime.__asyraBrowserDragPhaseSink
    propsManager.commitChanges = (options) => {
      pendingChangeCounts.push(propsManager.changes.length)
      originalCommitChanges.call(propsManager, options)
    }
    runtime.__asyraBrowserDragPhaseSink = (name) => {
      if (name.startsWith('props-manager:creation-')) {
        phaseNames.push(name)
      }
    }
    committedChanges.length = 0

    try {
      publishEvent({
        type: EventTypes.ADD_PROPERTY,
        payload: {
          eventName: EventTypes.ADD_PROPERTY,
          data: source,
          action: PROPS_ACTIONS.ADD_PROPERTY,
          undoType: EventTypes.REMOVE_PROPERTY,
          undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
        }
      })

      expect(pendingChangeCounts).toEqual([1])
      expect(committedChanges).toEqual([
        expect.objectContaining({
          eventName: EventTypes.ADD_PROPERTY,
          action: PROPS_ACTIONS.ADD_PROPERTY,
          data: source
        })
      ])
      expect(
        propsManager.getPropertyById('batch-position-first')?.save()
      ).toEqual(source[0])
      expect(
        propsManager.getPropertyById('batch-position-second')?.save()
      ).toEqual(source[1])
      expect(propsManager.changes).toEqual([])
      expect(
        applyPropertyCreationBatch.mock.calls.map(([plan]) => plan.componentIds)
      ).toEqual([['batch-position-first', 'batch-position-second']])
      expect(createProperty).not.toHaveBeenCalled()
      expect(addProperty).not.toHaveBeenCalled()
      expect(addToMap).not.toHaveBeenCalled()
      expect(phaseNames).toEqual([
        'props-manager:creation-preflight',
        'props-manager:creation-registry-readiness',
        'props-manager:creation-materialize',
        'props-manager:creation-post-materialize-readiness',
        'props-manager:creation-relationship-rebind',
        'props-manager:creation-pre-register-readiness',
        'props-manager:creation-register',
        'props-manager:creation-operation',
        'props-manager:creation-finalize',
        'props-manager:creation-evidence-save',
        'props-manager:creation-evidence-clone',
        'props-manager:creation-evidence'
      ])
    } finally {
      propsManager.commitChanges = originalCommitChanges
      applyPropertyCreationBatch.mockRestore()
      createProperty.mockRestore()
      addProperty.mockRestore()
      addToMap.mockRestore()
      if (previousSink) {
        runtime.__asyraBrowserDragPhaseSink = previousSink
      } else {
        delete runtime.__asyraBrowserDragPhaseSink
      }
      subscription.unsubscribe()
    }
  })

  it('preserves constructor defaults for a fresh partial ADD_PROPERTY batch', () => {
    const source = [
      {
        id: 'partial-position-first',
        type: PropertyTypes.POSITION
      },
      {
        id: 'partial-position-second',
        type: PropertyTypes.POSITION
      }
    ]
    const expected = source.map((property) =>
      new PositionComponent(property).save()
    )
    const committedChanges: PropsChange[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        committedChanges.push(
          (event as unknown as { payload: PropsChange }).payload
        )
      }
    })
    committedChanges.length = 0

    try {
      expect(() =>
        publishEvent({
          type: EventTypes.ADD_PROPERTY,
          payload: {
            data: source
          }
        })
      ).not.toThrow()

      expect(propsManager.save()).toEqual({
        'partial-position-first': expected[0],
        'partial-position-second': expected[1]
      })
      expect(committedChanges).toEqual([
        expect.objectContaining({
          eventName: EventTypes.ADD_PROPERTY,
          action: PROPS_ACTIONS.ADD_PROPERTY,
          data: expected
        })
      ])
      expect(propsManager.changes).toEqual([])
    } finally {
      subscription.unsubscribe()
    }
  })

  it('preserves declarative relationship defaults omitted by a partial ADD_PROPERTY batch', () => {
    const source = [
      {
        id: 'partial-default-parent',
        type: NESTED_PARENT_TYPE
      },
      {
        id: 'partial-default-position',
        type: PropertyTypes.POSITION
      }
    ]

    expect(() =>
      publishEvent({
        type: EventTypes.ADD_PROPERTY,
        payload: {
          data: source
        }
      })
    ).not.toThrow()

    expect(
      propsManager.getPropertyById('partial-default-parent')?.save()
    ).toEqual({
      id: 'partial-default-parent',
      type: NESTED_PARENT_TYPE,
      children: []
    })
    expect(
      propsManager.getPropertyById('partial-default-position')?.save()
    ).toEqual(new PositionComponent(source[1]).save())
    expect(propsManager.changes).toEqual([])
  })

  it('rebinds an omitted nonempty relationship default after a parent-first partial batch', () => {
    const relationshipType = 'partial-nonempty-default-parent'
    const relationshipDefinition = {
      type: relationshipType,
      defaults: {
        children: ['partial-nonempty-default-child'] as string[]
      },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    const RelationshipComponent = createPropertyComponentFromConfig(
      relationshipDefinition
    )
    registerPropertyComponent(
      relationshipType,
      RelationshipComponent,
      undefined,
      relationshipDefinition
    )

    publishEvent({
      type: EventTypes.ADD_PROPERTY,
      payload: {
        data: [
          {
            id: 'partial-nonempty-default-parent',
            type: relationshipType
          },
          {
            id: 'partial-nonempty-default-child',
            type: PropertyTypes.POSITION
          }
        ]
      }
    })

    const parent = propsManager.getPropertyById(
      'partial-nonempty-default-parent'
    )
    const child = propsManager.getPropertyById('partial-nonempty-default-child')
    const parentChanges: unknown[] = []
    parent?.on((change) => parentChanges.push(change))

    child?.set('x' as never, 55 as never)

    expect(parent?.save()).toEqual({
      id: 'partial-nonempty-default-parent',
      type: relationshipType,
      children: ['partial-nonempty-default-child']
    })
    expect(parentChanges).toEqual([
      expect.objectContaining({
        id: 'partial-nonempty-default-parent',
        key: 'children',
        after: 55
      })
    ])
  })

  it('preserves ordinary schema fallback for invalid values in a partial ADD_PROPERTY batch', () => {
    registerPropertySchema({
      type: PropertyTypes.POSITION,
      fields: [
        {
          key: 'x',
          kind: 'number',
          defaultValue: 0
        }
      ]
    })
    const source = [
      {
        id: 'partial-invalid-position',
        type: PropertyTypes.POSITION,
        x: 'invalid',
        y: 20,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      },
      {
        id: 'partial-valid-position',
        type: PropertyTypes.POSITION,
        x: 30,
        y: 40,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }
    ]

    expect(() =>
      publishEvent({
        type: EventTypes.ADD_PROPERTY,
        payload: {
          data: source
        }
      })
    ).not.toThrow()

    expect(
      propsManager.getPropertyById('partial-invalid-position')?.save()
    ).toEqual({
      id: 'partial-invalid-position',
      type: PropertyTypes.POSITION,
      x: 0,
      y: 20,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    })
    expect(
      propsManager.getPropertyById('partial-valid-position')?.save()
    ).toEqual(source[1])
    expect(propsManager.changes).toEqual([])
  })

  it('keeps pure string-id relationships inside one fresh canonical batch', () => {
    const source = [
      new PositionComponent({
        id: 'batch-child-first',
        type: PropertyTypes.POSITION,
        x: 10,
        y: 20,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }).save(),
      new PositionComponent({
        id: 'batch-child-second',
        type: PropertyTypes.POSITION,
        x: 30,
        y: 40,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }).save(),
      {
        id: 'batch-parent',
        type: NESTED_PARENT_TYPE,
        children: ['batch-child-first', 'batch-child-second']
      }
    ]
    const originalCommitChanges = propsManager.commitChanges
    const pendingChangeCounts: number[] = []
    propsManager.commitChanges = (options) => {
      pendingChangeCounts.push(propsManager.changes.length)
      originalCommitChanges.call(propsManager, options)
    }

    try {
      publishEvent({
        type: EventTypes.ADD_PROPERTY,
        payload: {
          eventName: EventTypes.ADD_PROPERTY,
          data: source,
          action: PROPS_ACTIONS.ADD_PROPERTY,
          undoType: EventTypes.REMOVE_PROPERTY,
          undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
        }
      })

      expect(pendingChangeCounts).toEqual([1])
      expect(propsManager.getPropertyById('batch-parent')?.save()).toEqual(
        source[2]
      )
      expect(propsManager.save()).toEqual(
        Object.fromEntries(source.map((property) => [property.id, property]))
      )
      const parent = propsManager.getPropertyById('batch-parent')
      const child = propsManager.getPropertyById('batch-child-first')
      const parentChanges: unknown[] = []
      parent?.on((change) => parentChanges.push(change))

      child?.set('x' as never, 55 as never)

      expect(parentChanges).toEqual([
        expect.objectContaining({
          id: 'batch-parent',
          key: 'children',
          after: 55
        })
      ])
    } finally {
      propsManager.commitChanges = originalCommitChanges
    }
  })

  it.each([
    {
      label: 'missing child',
      source: [
        new PositionComponent({
          id: 'invalid-missing-child-unrelated',
          type: PropertyTypes.POSITION,
          x: 1,
          y: 2,
          xUnit: Unit.PX,
          yUnit: Unit.PX
        }).save(),
        {
          id: 'invalid-missing-child-parent',
          type: NESTED_PARENT_TYPE,
          children: ['invalid-missing-child']
        }
      ],
      expected: /missing relation child/i
    },
    {
      label: 'wrong child type',
      source: [
        {
          id: 'invalid-wrong-type-child',
          type: NESTED_PARENT_TYPE,
          children: []
        },
        {
          id: 'invalid-wrong-type-parent',
          type: NESTED_PARENT_TYPE,
          children: ['invalid-wrong-type-child']
        }
      ],
      expected: /wrong type/i
    }
  ])(
    'rejects $label fresh relationship evidence before registration',
    ({ source, expected }) => {
      expect(() =>
        publishEvent({
          type: EventTypes.ADD_PROPERTY,
          payload: {
            eventName: EventTypes.ADD_PROPERTY,
            data: source as PropertyComponentRawData[],
            action: PROPS_ACTIONS.ADD_PROPERTY,
            undoType: EventTypes.REMOVE_PROPERTY,
            undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
          }
        })
      ).toThrow(expected)

      expect(propsManager.save()).toEqual({})
      expect(propsManager.changes).toEqual([])
    }
  )

  it('binds parent-first declarative relationship evidence without reordering it', () => {
    const source = [
      {
        id: 'parent-first-parent',
        type: NESTED_PARENT_TYPE,
        children: ['parent-first-child']
      },
      new PositionComponent({
        id: 'parent-first-child',
        type: PropertyTypes.POSITION,
        x: 1,
        y: 2,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }).save()
    ]
    const committedChanges: PropsChange[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        committedChanges.push(
          (event as unknown as { payload: PropsChange }).payload
        )
      }
    })
    committedChanges.length = 0

    try {
      publishEvent({
        type: EventTypes.ADD_PROPERTY,
        payload: {
          eventName: EventTypes.ADD_PROPERTY,
          data: source,
          action: PROPS_ACTIONS.ADD_PROPERTY,
          undoType: EventTypes.REMOVE_PROPERTY,
          undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
        }
      })

      expect(
        (
          committedChanges.find(
            ({ action }) => action === PROPS_ACTIONS.ADD_PROPERTY
          ) as AddRemovePropertyChange
        ).data.map(({ id }) => id)
      ).toEqual(['parent-first-parent', 'parent-first-child'])
      const parent = propsManager.getPropertyById('parent-first-parent')
      const child = propsManager.getPropertyById('parent-first-child')
      const parentChanges: unknown[] = []
      parent?.on((change) => parentChanges.push(change))

      child?.set('x' as never, 55 as never)

      expect(parentChanges).toEqual([
        expect.objectContaining({
          id: 'parent-first-parent',
          key: 'children',
          after: 55
        })
      ])
    } finally {
      subscription.unsubscribe()
    }
  })

  it('owns declarative relationship behavior after component factory creation', () => {
    const relationshipType = 'owned-declarative-relationship'
    const relationshipDefinition = {
      type: relationshipType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    const RelationshipComponent = createPropertyComponentFromConfig(
      relationshipDefinition
    )
    registerPropertyComponent(
      relationshipType,
      RelationshipComponent,
      undefined,
      relationshipDefinition
    )
    relationshipDefinition.children.key = 'mutatedChildren'

    publishEvent({
      type: EventTypes.ADD_PROPERTY,
      payload: {
        eventName: EventTypes.ADD_PROPERTY,
        data: [
          {
            id: 'owned-relationship-parent',
            type: relationshipType,
            children: ['owned-relationship-child']
          },
          new PositionComponent({
            id: 'owned-relationship-child',
            type: PropertyTypes.POSITION,
            x: 1,
            y: 2,
            xUnit: Unit.PX,
            yUnit: Unit.PX
          }).save()
        ],
        action: PROPS_ACTIONS.ADD_PROPERTY,
        undoType: EventTypes.REMOVE_PROPERTY,
        undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
      }
    })

    const parent = propsManager.getPropertyById('owned-relationship-parent')
    const child = propsManager.getPropertyById('owned-relationship-child')
    const parentChanges: unknown[] = []
    parent?.on((change) => parentChanges.push(change))

    child?.set('x' as never, 55 as never)

    expect(parentChanges).toEqual([
      expect.objectContaining({
        id: 'owned-relationship-parent',
        key: 'children',
        after: 55
      })
    ])
  })

  it('hides a parent-first declarative component until relationship rebind completes', () => {
    const relationshipType = 'pending-declarative-relationship'
    const relationshipDefinition = {
      type: relationshipType,
      defaults: { children: [] as string[] },
      persistKeys: ['children'],
      valueKeys: ['children'],
      children: {
        key: 'children',
        childType: PropertyTypes.POSITION,
        mode: 'ids' as const
      }
    }
    const RelationshipComponent = createPropertyComponentFromConfig(
      relationshipDefinition
    )
    let observedParentDuringChildConstruction = false
    class ObservingPositionComponent extends PositionComponent {
      constructor(data: ConstructorParameters<typeof PositionComponent>[0]) {
        super(data)
        observedParentDuringChildConstruction = Boolean(
          getPropertyComponentAccessor().getPropertyById(
            'pending-relationship-parent'
          )
        )
      }
    }
    propertyComponentRegistry.unregister(PropertyTypes.POSITION)
    registerPropertyComponent(
      PropertyTypes.POSITION,
      ObservingPositionComponent
    )
    registerPropertyComponent(
      relationshipType,
      RelationshipComponent,
      undefined,
      relationshipDefinition
    )

    publishEvent({
      type: EventTypes.ADD_PROPERTY,
      payload: {
        eventName: EventTypes.ADD_PROPERTY,
        data: [
          {
            id: 'pending-relationship-parent',
            type: relationshipType,
            children: ['pending-relationship-child']
          },
          new PositionComponent({
            id: 'pending-relationship-child',
            type: PropertyTypes.POSITION,
            x: 1,
            y: 2,
            xUnit: Unit.PX,
            yUnit: Unit.PX
          }).save()
        ],
        action: PROPS_ACTIONS.ADD_PROPERTY,
        undoType: EventTypes.REMOVE_PROPERTY,
        undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
      }
    })

    expect(observedParentDuringChildConstruction).toBe(false)
    const parent = propsManager.getPropertyById('pending-relationship-parent')
    const child = propsManager.getPropertyById('pending-relationship-child')
    const parentChanges: unknown[] = []
    parent?.on((change) => parentChanges.push(change))

    child?.set('x' as never, 55 as never)

    expect(parentChanges).toHaveLength(1)
  })

  it('rebinds multi-level parent-first relationships in dependency order', () => {
    const relationshipType = 'multi-level-declarative-relationship'
    const relationshipDefinition = {
      type: relationshipType,
      defaults: { children: [] as string[], value: 0 },
      persistKeys: ['children', 'value'],
      valueKeys: ['children', 'value'],
      children: {
        key: 'children',
        childType: relationshipType,
        mode: 'ids' as const
      }
    }
    const RelationshipComponent = createPropertyComponentFromConfig(
      relationshipDefinition
    )
    registerPropertyComponent(
      relationshipType,
      RelationshipComponent,
      undefined,
      relationshipDefinition
    )

    publishEvent({
      type: EventTypes.ADD_PROPERTY,
      payload: {
        eventName: EventTypes.ADD_PROPERTY,
        data: [
          {
            id: 'multi-level-middle',
            type: relationshipType,
            children: ['multi-level-leaf'],
            value: 0
          },
          {
            id: 'multi-level-parent',
            type: relationshipType,
            children: ['multi-level-middle'],
            value: 0
          },
          {
            id: 'multi-level-leaf',
            type: relationshipType,
            children: [],
            value: 0
          }
        ],
        action: PROPS_ACTIONS.ADD_PROPERTY,
        undoType: EventTypes.REMOVE_PROPERTY,
        undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
      }
    })

    const parent = propsManager.getPropertyById('multi-level-parent')
    const leaf = propsManager.getPropertyById('multi-level-leaf')
    const parentChanges: unknown[] = []
    parent?.on((change) => parentChanges.push(change))

    leaf?.set('value' as never, 55 as never)

    expect(parentChanges).toEqual([
      expect.objectContaining({
        id: 'multi-level-parent',
        key: 'children',
        after: 55
      })
    ])
  })

  it('rolls back a failed fresh ADD_PROPERTY payload without a prefix', () => {
    expect(() =>
      publishEvent({
        type: EventTypes.ADD_PROPERTY,
        payload: {
          eventName: EventTypes.ADD_PROPERTY,
          data: [
            new PositionComponent({
              id: 'batch-valid-prefix',
              type: PropertyTypes.POSITION,
              x: 10,
              y: 20,
              xUnit: Unit.PX,
              yUnit: Unit.PX
            }).save(),
            {
              id: 'batch-invalid-property',
              type: 'unregistered-property-type'
            }
          ],
          action: PROPS_ACTIONS.ADD_PROPERTY,
          undoType: EventTypes.REMOVE_PROPERTY,
          undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
        }
      })
    ).toThrow(/invalid component|not registered/i)

    expect(propsManager.getPropertyById('batch-valid-prefix')).toBeUndefined()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('rolls back a fresh ADD_PROPERTY payload when commit fails', () => {
    const originalCommitChanges = propsManager.commitChanges
    propsManager.commitChanges = () => {
      throw new Error('property commit failed')
    }

    try {
      expect(() =>
        publishEvent({
          type: EventTypes.ADD_PROPERTY,
          payload: {
            eventName: EventTypes.ADD_PROPERTY,
            data: [
              new PositionComponent({
                id: 'batch-commit-first',
                type: PropertyTypes.POSITION,
                x: 10,
                y: 20,
                xUnit: Unit.PX,
                yUnit: Unit.PX
              }).save(),
              new PositionComponent({
                id: 'batch-commit-second',
                type: PropertyTypes.POSITION,
                x: 30,
                y: 40,
                xUnit: Unit.PX,
                yUnit: Unit.PX
              }).save()
            ],
            action: PROPS_ACTIONS.ADD_PROPERTY,
            undoType: EventTypes.REMOVE_PROPERTY,
            undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
          }
        })
      ).toThrow('property commit failed')
    } finally {
      propsManager.commitChanges = originalCommitChanges
    }

    expect(propsManager.getPropertyById('batch-commit-first')).toBeUndefined()
    expect(propsManager.getPropertyById('batch-commit-second')).toBeUndefined()
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
  })

  it('disposes fresh relationship bindings when commit rollback removes the batch', () => {
    const source = [
      {
        id: 'rollback-relationship-parent',
        type: NESTED_PARENT_TYPE,
        children: ['rollback-relationship-child']
      },
      new PositionComponent({
        id: 'rollback-relationship-child',
        type: PropertyTypes.POSITION,
        x: 10,
        y: 20,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }).save()
    ]
    const parentChanges: unknown[] = []
    let child: ReturnType<typeof propsManager.getPropertyById>
    const originalCommitChanges = propsManager.commitChanges
    propsManager.commitChanges = () => {
      child = propsManager.getPropertyById('rollback-relationship-child')
      propsManager
        .getPropertyById('rollback-relationship-parent')
        ?.on((change) => parentChanges.push(change))
      throw new Error('relationship commit failed')
    }

    try {
      expect(() =>
        publishEvent({
          type: EventTypes.ADD_PROPERTY,
          payload: {
            eventName: EventTypes.ADD_PROPERTY,
            data: source,
            action: PROPS_ACTIONS.ADD_PROPERTY,
            undoType: EventTypes.REMOVE_PROPERTY,
            undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
          }
        })
      ).toThrow('relationship commit failed')
    } finally {
      propsManager.commitChanges = originalCommitChanges
    }

    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
    child?.set('x' as never, 55 as never)
    expect(parentChanges).toEqual([])
  })

  it('preserves ordinary non-replay replacement when an ADD_PROPERTY id is active', () => {
    const active = new PositionComponent({
      id: 'active-replacement',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    })
    propsManager.addToMap(active)
    const replacement = new PositionComponent({
      id: 'active-replacement',
      type: PropertyTypes.POSITION,
      x: 10,
      y: 20,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }).save()
    const fresh = new PositionComponent({
      id: 'active-replacement-peer',
      type: PropertyTypes.POSITION,
      x: 30,
      y: 40,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }).save()

    publishEvent({
      type: EventTypes.ADD_PROPERTY,
      payload: {
        eventName: EventTypes.ADD_PROPERTY,
        data: [replacement, fresh],
        action: PROPS_ACTIONS.ADD_PROPERTY,
        undoType: EventTypes.REMOVE_PROPERTY,
        undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
      }
    })

    expect(propsManager.getPropertyById('active-replacement')).not.toBe(active)
    expect(propsManager.getPropertyById('active-replacement')?.save()).toEqual(
      replacement
    )
    expect(
      propsManager.getPropertyById('active-replacement-peer')?.save()
    ).toEqual(fresh)
    expect(propsManager.changes).toEqual([])
  })

  it('preserves ordinary non-replay replacement when an ADD_PROPERTY id is a top-level tombstone', () => {
    const tombstone = new PositionComponent({
      id: 'top-level-tombstone',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    })
    propsManager.addToMap(tombstone)
    propsManager.removeProperty(['top-level-tombstone'])
    propsManager.cleanChanges()
    const replacement = new PositionComponent({
      id: 'top-level-tombstone',
      type: PropertyTypes.POSITION,
      x: 10,
      y: 20,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }).save()
    const fresh = new PositionComponent({
      id: 'top-level-tombstone-peer',
      type: PropertyTypes.POSITION,
      x: 30,
      y: 40,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    }).save()

    publishEvent({
      type: EventTypes.ADD_PROPERTY,
      payload: {
        eventName: EventTypes.ADD_PROPERTY,
        data: [replacement, fresh],
        action: PROPS_ACTIONS.ADD_PROPERTY,
        undoType: EventTypes.REMOVE_PROPERTY,
        undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
      }
    })

    expect(propsManager.getPropertyById('top-level-tombstone')).not.toBe(
      tombstone
    )
    expect(propsManager.getPropertyById('top-level-tombstone')?.save()).toEqual(
      replacement
    )
    expect(
      propsManager.getPropertyById('top-level-tombstone-peer')?.save()
    ).toEqual(fresh)
    expect(propsManager.changes).toEqual([])
  })

  it('preserves ordinary nested tombstone replacement outside the fresh batch path', () => {
    const tombstone = new PositionComponent({
      id: 'nested-tombstone',
      type: PropertyTypes.POSITION,
      x: 1,
      y: 2,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    })
    propsManager.addToMap(tombstone)
    propsManager.removeProperty(['nested-tombstone'])
    propsManager.cleanChanges()

    publishEvent({
      type: EventTypes.ADD_PROPERTY,
      payload: {
        eventName: EventTypes.ADD_PROPERTY,
        data: [
          {
            id: 'nested-parent',
            type: NESTED_PARENT_TYPE,
            children: [
              {
                id: 'nested-tombstone',
                x: 10,
                y: 20,
                xUnit: Unit.PX,
                yUnit: Unit.PX
              }
            ]
          },
          new PositionComponent({
            id: 'nested-parent-peer',
            type: PropertyTypes.POSITION,
            x: 30,
            y: 40,
            xUnit: Unit.PX,
            yUnit: Unit.PX
          }).save()
        ],
        action: PROPS_ACTIONS.ADD_PROPERTY,
        undoType: EventTypes.REMOVE_PROPERTY,
        undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
      }
    })

    const replacement = propsManager.getPropertyById('nested-tombstone')
    expect(replacement).not.toBe(tombstone)
    expect(replacement?.save()).toEqual(
      new PositionComponent({
        id: 'nested-tombstone',
        type: PropertyTypes.POSITION,
        x: 10,
        y: 20,
        xUnit: Unit.PX,
        yUnit: Unit.PX
      }).save()
    )
    expect(propsManager.getPropertyById('nested-parent')?.save()).toEqual({
      id: 'nested-parent',
      type: NESTED_PARENT_TYPE,
      children: ['nested-tombstone']
    })
    expect(propsManager.changes).toEqual([])
  })

  it('records the exact tombstone snapshot restored by an ADD_PROPERTY replay', () => {
    const restored = new PositionComponent({
      id: 'group-position',
      type: PropertyTypes.POSITION,
      x: 220,
      y: 0,
      xUnit: Unit.PX,
      yUnit: Unit.PX
    })
    propsManager.addToMap(restored)
    propsManager.removeProperty(['group-position'])
    propsManager.cleanChanges()

    const committedChanges: PropsChange[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_TRANSACTION) {
        committedChanges.push(
          (event as unknown as { payload: PropsChange }).payload
        )
      }
    })
    committedChanges.length = 0

    try {
      runInTransactionReplayMode('redo', () =>
        publishEvent({
          type: EventTypes.ADD_PROPERTY,
          payload: {
            eventName: EventTypes.ADD_PROPERTY,
            data: [
              {
                id: 'group-position',
                type: PropertyTypes.POSITION,
                x: 0,
                y: 0,
                xUnit: Unit.PX,
                yUnit: Unit.PX
              }
            ],
            action: PROPS_ACTIONS.ADD_PROPERTY,
            undoType: EventTypes.REMOVE_PROPERTY,
            undoAction: PROPS_ACTIONS.REMOVE_PROPERTY
          }
        })
      )

      expect(propsManager.getPropertyById('group-position')).toBe(restored)
      expect(committedChanges).toEqual([
        expect.objectContaining({
          eventName: EventTypes.ADD_PROPERTY,
          action: PROPS_ACTIONS.ADD_PROPERTY,
          data: [restored.save()]
        })
      ])
    } finally {
      subscription.unsubscribe()
    }
  })
})
