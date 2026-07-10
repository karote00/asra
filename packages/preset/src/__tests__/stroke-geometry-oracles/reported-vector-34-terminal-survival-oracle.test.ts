import { describe } from 'vitest'
import { registerReportedVector34TerminalOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34TerminalSurvivalOracleTitles = [
  'preserves every independent miter terminal half dash from Step 27/30 products through final faces and render entries',
  'preserves every independent bevel terminal half dash from Step 27/30 products through final faces and render entries',
  'preserves every independent round terminal half dash from Step 27/30 products through final faces and render entries'
] as const

describe('formal stroke geometry oracle: reported vector-34 terminal survival', () =>
  registerReportedVector34TerminalOracleTests({
    groups: ['half-dash-survival']
  }))
