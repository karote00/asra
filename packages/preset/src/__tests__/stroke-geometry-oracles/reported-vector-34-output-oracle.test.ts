import { describe } from 'vitest'
import { registerReportedVector34OutputOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34OutputOracleTitles = [
  'rejects repeated-alpha same-paint overdraw on reported miter outside dashed render entries',
  'rejects repeated-alpha same-paint overdraw on reported bevel outside dashed render entries',
  'rejects repeated-alpha same-paint overdraw on reported round outside dashed render entries'
] as const

describe('formal stroke geometry oracle: reported vector-34 output', () =>
  registerReportedVector34OutputOracleTests({ groups: ['alpha-overdraw'] }))
