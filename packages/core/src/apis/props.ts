import { PropsComponentRawData } from '@asra/utils'
import { APIDeps, PropsRawAPIs } from '../types'

export const createPropsAPIs = (props: APIDeps['props']): PropsRawAPIs => {
  return {
    loadProps(data: PropsComponentRawData) {
      props.load(data)
    },
    saveProps() {
      return props.save()
    }
  }
}
