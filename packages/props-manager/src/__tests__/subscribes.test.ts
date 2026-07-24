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
import { PositionComponent } from './helpers/test-property-components'

describe('props-manager subscribes', () => {
  beforeEach(() => {
    propsManager.reset()
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
