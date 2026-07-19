import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EntityTypes,
  SCENE_TREE_ACTIONS,
  Setter,
  type ElementAttrs
} from '@asyra/utils'
import { EventTypes } from '@asyra/reactive-events'
import sceneTree from '../sceneTree'
import ElementChangeHandler from '../components/element-change-handler'

describe('ElementChangeHandler canonical owner provenance', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it.each(['raw', 'computed'] as const)(
    'emits %s owner provenance with the committed scalar change',
    (owner) => {
      const addChange = vi
        .spyOn(sceneTree, 'addChange')
        .mockImplementation(() => undefined)
      const handler = new ElementChangeHandler(owner)

      handler.addChange({
        id: 'element-1',
        key: 'visible',
        before: true,
        after: false
      })

      expect(addChange).toHaveBeenCalledWith({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        owner,
        id: 'element-1',
        key: 'visible',
        before: true,
        after: false
      })
    }
  )

  it.each(['raw', 'computed'] as const)(
    'preserves %s provenance through the Setter callback boundary',
    (owner) => {
      const addChange = vi
        .spyOn(sceneTree, 'addChange')
        .mockImplementation(() => undefined)
      const handler = new ElementChangeHandler(owner)
      const setter = new Setter<ElementAttrs>(handler.addChange)
      setter.data = {
        id: 'element-1',
        type: EntityTypes.ELEMENT,
        name: 'Element',
        parentId: '',
        visible: true,
        lock: false
      }

      setter.set('visible', false)

      expect(addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          owner,
          id: 'element-1',
          key: 'visible',
          before: true,
          after: false
        })
      )
    }
  )
})
