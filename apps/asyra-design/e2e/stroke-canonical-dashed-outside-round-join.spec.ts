import { test } from '@playwright/test'
import {
  runCanonicalDashedOutsideSourceJoinMatrixCase,
  runCanonicalDashedOutsideSourceJoinReviewCase
} from './stroke-canonical-matrix-utils'

test.describe.configure({ mode: 'serial' })

const caseDef = {
  key: 'dashed-outside-butt-round-join',
  joinType: 'round' as const
}

test('canonical stroke matrix: dashed outside source vertex round join', async (
  { page },
  testInfo
) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedOutsideSourceJoinMatrixCase(page, caseDef)
})

test('canonical stroke matrix: dashed outside source vertex round join closeups', async (
  { page },
  testInfo
) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedOutsideSourceJoinReviewCase(page, caseDef)
})
