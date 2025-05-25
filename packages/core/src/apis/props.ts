import { propsLoadData, propsSaveData } from '@asra/reactive-events'
import { PropsComponentRawData } from '@asra/utils'
import { PropsRawAPIs } from '../types'

export const createPropsAPIs = (): PropsRawAPIs => {
  return {
    propsLoadData(data: PropsComponentRawData) {
      propsLoadData(data)
    },
    async propsSaveData() {
      return await propsSaveData()
    }
  }
}
