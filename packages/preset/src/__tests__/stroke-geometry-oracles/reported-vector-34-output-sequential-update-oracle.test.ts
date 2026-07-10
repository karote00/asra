import { describe } from 'vitest'
import { registerReportedVector34OutputOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34OutputSequentialUpdateOracleTitles = [
  'rejects internal shared-boundary render polygons after sequential reported miter outside dashed join changes',
  'rejects internal shared-boundary render polygons after sequential reported bevel outside dashed join changes',
  'rejects internal shared-boundary render polygons after sequential reported round outside dashed join changes'
] as const

describe('formal stroke geometry oracle: reported vector-34 output sequential update', () =>
  registerReportedVector34OutputOracleTests({ groups: ['sequential-update'] }))
