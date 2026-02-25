import type { ChangeHandler, DataTypes, EvnetOptions } from '@asyra/utils'
import { OWNER, SCENE_TREE_ACTIONS } from '@asyra/utils'
import { EventTypes } from '@asyra/reactive-events'
import sceneTree from '../sceneTree'

export default class ElementChangeHandler implements ChangeHandler {
  addChange(data: {
    id: string
    key: string
    before: DataTypes
    after: DataTypes
    options?: EvnetOptions
  }): void {
    sceneTree.addChange({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      owner: OWNER.SCENE_TREE,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      ...data
    })
  }
}
