import type { ChangeHandler, DataTypes } from '@asra/utils'
import { OWNER, PROPS_ACTIONS } from '@asra/utils'
import { EventTypes } from '@asra/reactive-events'
import propsManager from '../props-manager'

export default class PropsChangeHandler implements ChangeHandler {
  addChange(data: {
    id: string
    key: string
    before: DataTypes
    after: DataTypes
  }): void {
    propsManager.addChange({
      action: PROPS_ACTIONS.UPDATE_PROPERTY,
      owner: OWNER.SCENE_TREE,
      eventName: EventTypes.UPDATE_PROPERTY,
      ...data
    })
  }
}
