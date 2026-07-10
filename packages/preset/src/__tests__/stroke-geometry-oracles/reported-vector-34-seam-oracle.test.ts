import { describe } from 'vitest'
import { registerReportedVector34SeamOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34SeamOracleTitles = [
  'keeps exact reported vector-34 miter outside dashed seam continuity for dash 20 gap 20',
  'keeps exact reported vector-34 bevel outside dashed seam continuity for dash 20 gap 20',
  'keeps exact reported vector-34 round outside dashed seam continuity for dash 20 gap 20'
] as const

describe('formal stroke geometry oracle: reported vector-34 seam', () =>
  registerReportedVector34SeamOracleTests({ groups: ['continuity'] }))
