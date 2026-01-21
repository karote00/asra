import { PropsComponentRawData } from '@asra/utils'

export interface PropsRawAPIs {
  propsLoadData: (data: PropsComponentRawData) => void
  propsSaveData: () => PropsComponentRawData
}

export type PropsAPIs = PropsRawAPIs
