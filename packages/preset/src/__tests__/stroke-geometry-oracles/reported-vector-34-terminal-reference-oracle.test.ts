import { describe } from 'vitest'
import { registerReportedVector34TerminalOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34TerminalReferenceOracleTitles = [
  'proves Step 22 and Step 23 declare the failing inside source segment endpoint as an independent end terminal interval',
  'keeps constrained inside terminal half-dash products painted near every independent segment endpoint',
  'keeps constrained outside terminal half-dash products painted near every independent segment endpoint'
] as const

describe('formal stroke geometry oracle: reported vector-34 terminal reference endpoints', () =>
  registerReportedVector34TerminalOracleTests({
    groups: ['reference-endpoints']
  }))
