import { beforeEach, describe, expect, it } from 'vitest'
import { endTransaction, EventTypes } from '@asyra/reactive-events'
import type { PropsChange } from '@asyra/utils'
import propsManager from '..'

describe('props-manager subscribes', () => {
  beforeEach(() => {
    propsManager.reset()
  })

  it('clears pending property changes on endTransaction', () => {
    const pendingChange = {
      owner: 'props',
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
})
