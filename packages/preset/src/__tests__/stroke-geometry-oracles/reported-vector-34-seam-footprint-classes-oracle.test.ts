import { describe } from 'vitest'
import { registerReportedVector34SeamOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34SeamFootprintClassesOracleTitles = [
  'keeps constrained outside dashed miter, bevel, and round source-vertex footprints distinct in runtime product artifacts'
] as const

describe('formal stroke geometry oracle: reported vector-34 seam footprint classes', () =>
  registerReportedVector34SeamOracleTests({ groups: ['footprint-classes'] }))
