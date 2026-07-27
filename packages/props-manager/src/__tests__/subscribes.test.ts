import { beforeEach, describe, expect, it } from 'vitest'
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
  PropertyTypes,
  Unit,
  type PropsChange
} from '@asyra/utils'
import propsManager from '..'
import {
  propertyComponentRegistry,
  registerPropertyComponent
} from '../registries/property-component'
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
    propsManager.commitChanges = (options) => {
      pendingChangeCounts.push(propsManager.changes.length)
      originalCommitChanges.call(propsManager, options)
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
    } finally {
      propsManager.commitChanges = originalCommitChanges
      subscription.unsubscribe()
    }
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
    } finally {
      propsManager.commitChanges = originalCommitChanges
    }
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
    ).toThrow(/not registered/i)

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
