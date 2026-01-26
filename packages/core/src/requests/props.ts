import { PropsComponentRawData } from '@asyra/utils'
import { PropsRequestDeps, PropsRequests } from '../types'

/**
 * Request API for Props data
 * Provides synchronous access to props state with dependency injection
 */

export const createPropsRequests = (deps: PropsRequestDeps): PropsRequests => ({
  propsLoadData: (data: PropsComponentRawData): void => {
    deps.props.load(data)
  },
  propsSaveData: (): PropsComponentRawData => {
    return deps.props.save()
  }
})
