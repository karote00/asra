// Request API Types
// Domain-specific type definitions for request layer

import {
  SystemContextRequests,
  SystemContextRequestsDeps
} from './system-context'
import { PropsRequests, PropsRequestDeps } from './props'

export {
  SystemContextRequests,
  SystemContextRequestsDeps,
  PropsRequests,
  PropsRequestDeps
}

export type RequestsDeps = SystemContextRequestsDeps & PropsRequestDeps

export interface Requests {
  systemContextRequests: SystemContextRequests
  propsRequests: PropsRequests
}
