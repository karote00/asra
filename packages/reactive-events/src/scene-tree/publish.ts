import type { ElementRawData } from '@asra/utils'
import { EntityTypes } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const addRectangle = (elementData?: ElementRawData) => {
  publishEvent({
    type: EventTypes.ADD_ELEMENT,
    payload: {
      elementData: elementData ?? { type: EntityTypes.RECTANGLE }
    }
  })
}
