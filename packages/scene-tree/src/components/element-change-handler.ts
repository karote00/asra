import type {
  ChangeHandler,
  DataTypes,
  EvnetOptions,
  SceneTreeDataOwner
} from '@asyra/utils'
import { SCENE_TREE_ACTIONS } from '@asyra/utils'
import { EventTypes } from '@asyra/reactive-events'
import sceneTree from '../sceneTree'

export default class ElementChangeHandler implements ChangeHandler {
  constructor(private readonly owner: SceneTreeDataOwner) {}

  addChange = (data: {
    id: string
    key: string
    before: DataTypes
    after: DataTypes
    options?: EvnetOptions
  }): void => {
    sceneTree.addChange({
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      owner: this.owner,
      ...data
    })
  }
}
