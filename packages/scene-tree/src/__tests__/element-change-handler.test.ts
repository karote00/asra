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

  it('records raw element fields as canonical UPDATE_ELEMENT_DATA evidence', () => {
    expect(SCENE_TREE_ACTIONS).toMatchObject({
      UPDATE_ELEMENT_DATA: 'updateElementData'
    })
    expect(EventTypes).toMatchObject({
      UPDATE_ELEMENT_DATA: 'updateElementData'
    })

    const addChange = vi
      .spyOn(sceneTree, 'addChange')
      .mockImplementation(() => undefined)
    const handler = new ElementChangeHandler()

    handler.addChange({
      id: 'element-1',
      key: 'visible',
      before: true,
      after: false
    })

    expect(addChange).toHaveBeenCalledWith({
      action: 'updateElementData',
      eventName: 'updateElementData',
      id: 'element-1',
      changes: [
        {
          key: 'visible',
          before: true,
          after: false
        }
      ]
    })
  })

  it('does not turn non-element fields into canonical Scene evidence', () => {
    const addChange = vi
      .spyOn(sceneTree, 'addChange')
      .mockImplementation(() => undefined)
    const handler = new ElementChangeHandler()

    handler.addChange({
      id: 'element-1',
      key: 'x',
      before: 0,
      after: 24
    })

    expect(addChange).not.toHaveBeenCalled()
  })

  it('preserves the raw element route through the Setter callback boundary', () => {
    const addChange = vi
      .spyOn(sceneTree, 'addChange')
      .mockImplementation(() => undefined)
    const handler = new ElementChangeHandler()
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
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'element-1',
        changes: [
          {
            key: 'visible',
            before: true,
            after: false
          }
        ]
      })
    )
  })
})
