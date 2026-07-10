import { describe } from 'vitest'
import { registerReportedVector34SeamOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34SeamMicroscopeRoundOracleTitles = [
  'keeps round outside dashed source-span and anchor coverage under microscope probes'
] as const

describe('formal stroke geometry oracle: reported vector-34 seam microscope round', () =>
  registerReportedVector34SeamOracleTests({
    groups: ['microscope'],
    joinTypes: ['round']
  }))
