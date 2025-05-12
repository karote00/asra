import { PropsComponentRawData } from '@asra/utils'

export interface PropsRawAPIs {
  loadProps: (data: PropsComponentRawData) => void
  saveProps: () => void
}

export type PropsAPIs = PropsRawAPIs
