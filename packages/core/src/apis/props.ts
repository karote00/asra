import { PropsComponentRawData } from '@asra/utils'
import { APIDeps, RenderPropsAPIs } from '../types'

export const createPropsAPIs = (props: APIDeps['props']): RenderPropsAPIs => {
  return {
    loadProps(data: PropsComponentRawData) {
      props.load(data)
    },
    saveProps() {
      return props.save()
    }
  }
}
