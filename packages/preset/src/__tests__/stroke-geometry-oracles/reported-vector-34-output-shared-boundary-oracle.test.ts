import { describe } from 'vitest'
import { registerReportedVector34OutputOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34OutputSharedBoundaryOracleTitles = [
  'rejects internal shared-boundary render polygons on reported miter outside dashed render entries',
  'rejects internal shared-boundary render polygons on reported bevel outside dashed render entries',
  'rejects internal shared-boundary render polygons on reported round outside dashed render entries'
] as const

describe('formal stroke geometry oracle: reported vector-34 output shared boundary', () =>
  registerReportedVector34OutputOracleTests({ groups: ['shared-boundary'] }))
