import { PropsComponentRawData } from '@asra/utils'

export interface RenderPropsAPIs {
  loadProps: (data: PropsComponentRawData) => void
  saveProps: () => void
}
