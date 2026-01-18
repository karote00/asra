// Request API Layer - Pure data access functions
// This layer provides synchronous access to system data without business logic

import { createSystemContextRequests } from './system-context'
import { Requests, RequestsDeps } from '../types'

export const createRequests = (deps: RequestsDeps): Requests => {
  return {
    ...createSystemContextRequests({ systemContext: deps.systemContext })
  }
}
