import { PositionData, DimensionData } from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const coreAddElement = (data: PositionData & Partial<DimensionData>) => {
  publishEvent({
    type: EventTypes.CORE_ADD_ELEMENT,
    payload: {
      ...data
    }
  })
}
