import { describe } from 'vitest'
import { registerReportedVector34OutputOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34OutputOutsideLegalityOracleTitles = [
  'keeps reported miter outside dashed render products on the authored outside stroke position',
  'keeps reported bevel outside dashed render products on the authored outside stroke position',
  'keeps reported round outside dashed render products on the authored outside stroke position'
] as const

describe('formal stroke geometry oracle: reported vector-34 output outside legality', () =>
  registerReportedVector34OutputOracleTests({ groups: ['outside-legality'] }))
