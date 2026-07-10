import { describe } from 'vitest'
import { registerReportedVector34TerminalOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34TerminalOracleTitles = [
  'preserves miter terminal ownership as non-visible Step 30 evidence over Step 27 bodies',
  'preserves bevel terminal ownership as non-visible Step 30 evidence over Step 27 bodies',
  'preserves round terminal ownership as non-visible Step 30 evidence over Step 27 bodies'
] as const

describe('formal stroke geometry oracle: reported vector-34 terminal', () =>
  registerReportedVector34TerminalOracleTests({
    groups: ['ownership-evidence']
  }))
