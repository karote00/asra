import { describe } from 'vitest'
import { registerReportedVector34SeamOracleTests } from './reported-vector-34-runtime-oracle-fixture'

export const reportedVector34SeamJoinConnectivityOracleTitles = [
  'connects reported miter sharp source-vertex joins to incident dash bodies without seam gaps',
  'connects reported bevel sharp source-vertex joins to incident dash bodies without seam gaps',
  'connects reported round sharp source-vertex joins to incident dash bodies without seam gaps'
] as const

describe('formal stroke geometry oracle: reported vector-34 seam join connectivity', () =>
  registerReportedVector34SeamOracleTests({ groups: ['join-connectivity'] }))
