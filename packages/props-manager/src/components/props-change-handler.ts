import type { ChangeHandler, DataTypes } from '@asyra/utils'
import { OWNER, PROPS_ACTIONS } from '@asyra/utils'
import { EventTypes } from '@asyra/reactive-events'
import propsManager from '../manager/props-manager'

export default class PropsChangeHandler implements ChangeHandler {
  addChange(data: {
    id: string
    key: string
    before: DataTypes
    after: DataTypes
  }): void {
    propsManager.addChange({
      action: PROPS_ACTIONS.UPDATE_PROPERTY,
      owner: OWNER.PROPS,
      eventName: EventTypes.UPDATE_PROPERTY,
      ...data
    })
  }
}
