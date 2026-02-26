import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ReactiveEventsModule from '@asyra/reactive-events'
import type { UpdateTransactionEvent } from '@asyra/reactive-events'
import {
  OWNER,
  SCENE_TREE_ACTIONS,
  type SceneTreeChange,
  type ElementInstanceTypes
} from '@asyra/utils'
import { SceneTree } from '../sceneTree'

const captureUpdateTransactionEvents = () => {
  const events: UpdateTransactionEvent[] = []
  const subscription = ReactiveEventsModule.subscribeToEvents((event) => {
    if (event.type === ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION) {
      events.push(event as UpdateTransactionEvent)
    }
  })
  // ReplaySubject replays last event on subscribe; reset to current test scope.
  events.length = 0

  return { events, subscription }
}

const createUpdateChange = (
  overrides: Partial<SceneTreeChange> = {}
): SceneTreeChange =>
  ({
    action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
    owner: OWNER.SCENE_TREE,
    eventName: ReactiveEventsModule.EventTypes.UPDATE_COMPUTED_DATA,
    id: 'element-1',
    key: 'x',
    before: 0,
    after: 10,
    ...overrides
  }) as SceneTreeChange

describe('SceneTree transaction options', () => {
  let sceneTree: SceneTree

  beforeEach(() => {
    vi.clearAllMocks()
    sceneTree = new SceneTree()
  })

  it('forwards per-change options to updateTransaction', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const change = createUpdateChange({ options: { undoable: false } })
    sceneTree.addChange(change)

    sceneTree.commitSceneTreeTransaction()

    expect(events).toEqual([
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: change,
        options: { undoable: false }
      })
    ])
    subscription.unsubscribe()
  })

  it('uses commit fallback options when change has none', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const change = createUpdateChange()
    sceneTree.addChange(change)

    sceneTree.commitSceneTreeTransaction({ undoable: false })

    expect(events).toEqual([
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: change,
        options: { undoable: false }
      })
    ])
    subscription.unsubscribe()
  })

  it('calls updateTransaction without options when neither path provides options', () => {
    const { events, subscription } = captureUpdateTransactionEvents()
    const change = createUpdateChange()
    sceneTree.addChange(change)

    sceneTree.commitSceneTreeTransaction()

    expect(events).toEqual([
      expect.objectContaining({
        type: ReactiveEventsModule.EventTypes.UPDATE_TRANSACTION,
        eventName: change.eventName,
        payload: change,
        options: undefined
      })
    ])
    subscription.unsubscribe()
  })

  it('passes options through updateComputedData to element level set flow', () => {
    const element = {
      get: vi.fn(() => 'element-1'),
      updateComputedData: vi.fn()
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(element)

    sceneTree.updateComputedData('element-1', 'x', 10, { undoable: false })

    expect(element.updateComputedData).toHaveBeenCalledWith('x', 10, {
      undoable: false
    })
  })
})
