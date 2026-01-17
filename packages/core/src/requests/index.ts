// Request API Layer - Pure data access functions
// This layer provides synchronous access to system data without business logic

import { createSystemContextRequestAPIs } from './system-context'
import { RequestAPIs, RequestAPIsDeps } from '../types'

export const createRequestAPIs = (deps: RequestAPIsDeps): RequestAPIs => {
  return {
    ...createSystemContextRequestAPIs({ systemContext: deps.systemContext })
  }
}
