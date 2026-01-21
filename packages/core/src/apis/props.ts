import { PropsComponentRawData } from '@asra/utils'
import { PropsRawAPIs, PropsRequests } from '../types'

export const createPropsAPIs = (propsRequests: PropsRequests): PropsRawAPIs => {
  return {
    propsLoadData(data: PropsComponentRawData) {
      propsRequests.propsLoadData(data)
    },
    propsSaveData() {
      return propsRequests.propsSaveData()
    }
  }
}
