import { describe } from 'vitest'
import { registerReportedVector34OutputOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34OutputMetadataOwnershipOracleTitles = [
  'preserves miter runtime metadata and prevents renderer descriptor replay from owning sharp join shape',
  'preserves bevel runtime metadata and prevents renderer descriptor replay from owning sharp join shape',
  'preserves round runtime metadata and prevents renderer descriptor replay from owning sharp join shape'
] as const

describe('formal stroke geometry oracle: reported vector-34 output metadata ownership', () =>
  registerReportedVector34OutputOracleTests({ groups: ['metadata-ownership'] }))
