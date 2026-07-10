import { describe } from 'vitest'
import { registerReportedVector34SeamOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34SeamTerminalResidueOracleTitles = [
  'does not emit miter source-vertex terminal-body residue without seam-boundary provenance',
  'does not emit bevel source-vertex terminal-body residue without seam-boundary provenance',
  'does not emit round source-vertex terminal-body residue without seam-boundary provenance'
] as const

describe('formal stroke geometry oracle: reported vector-34 seam terminal residue', () =>
  registerReportedVector34SeamOracleTests({ groups: ['terminal-residue'] }))
