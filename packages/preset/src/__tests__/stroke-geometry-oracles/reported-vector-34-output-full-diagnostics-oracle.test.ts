import { describe } from 'vitest'
import { registerReportedVector34OutputOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34OutputFullDiagnosticsOracleTitles = [
  'rejects internal shared-boundary render polygons in full diagnostics miter app-runtime mode',
  'rejects internal shared-boundary render polygons in full diagnostics bevel app-runtime mode',
  'rejects internal shared-boundary render polygons in full diagnostics round app-runtime mode'
] as const

describe('formal stroke geometry oracle: reported vector-34 output full diagnostics', () =>
  registerReportedVector34OutputOracleTests({ groups: ['full-diagnostics'] }))
