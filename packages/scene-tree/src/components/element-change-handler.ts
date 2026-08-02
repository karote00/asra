import type { ChangeHandler, DataTypes, EvnetOptions } from '@asyra/utils'
import { SCENE_TREE_ACTIONS } from '@asyra/utils'
import { EventTypes } from '@asyra/reactive-events'
import sceneTree from '../sceneTree'

export default class ElementChangeHandler implements ChangeHandler {
  addChange = (data: {
    id: string
    key: string
    before: DataTypes
    after: DataTypes
    options?: EvnetOptions
  }): void => {
    if (data.key !== 'name' && data.key !== 'visible' && data.key !== 'lock') {
      return
    }
    sceneTree.addChange({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
      eventName: EventTypes.UPDATE_ELEMENT_DATA,
      id: data.id,
      changes: [
        {
          key: data.key,
          before: data.before as string | boolean,
          after: data.after as string | boolean
        }
      ],
      options: data.options
    })
  }
}
