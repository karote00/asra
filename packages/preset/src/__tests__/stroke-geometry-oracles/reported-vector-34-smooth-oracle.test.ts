import { describe } from 'vitest'
import { registerReportedVector34SmoothOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34SmoothOracleTitles = [
  'keeps miter smooth anchors out of source-vertex join ownership and prevents fragmented smooth-continuity output',
  'keeps bevel smooth anchors out of source-vertex join ownership and prevents fragmented smooth-continuity output',
  'keeps round smooth anchors out of source-vertex join ownership and prevents fragmented smooth-continuity output',
  'preserves high-curvature smooth ownership as non-visible Step 31 evidence over Step 27 bodies'
] as const

describe(
  'formal stroke geometry oracle: reported vector-34 smooth',
  registerReportedVector34SmoothOracleTests
)
