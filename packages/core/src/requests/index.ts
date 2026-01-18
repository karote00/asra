// Request API Layer - Pure data access functions
// This layer provides synchronous access to system data without business logic

import { createSystemContextRequests } from './system-context'
import { createPropsRequests } from './props'
import { Requests, RequestsDeps } from '../types'

export const createRequests = (deps: RequestsDeps): Requests => {
  return {
    systemContextRequests: createSystemContextRequests({
      systemContext: deps.systemContext
    }),
    propsRequests: createPropsRequests({ props: deps.props })
  }
}
