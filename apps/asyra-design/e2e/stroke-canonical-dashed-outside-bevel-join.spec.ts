import { test } from '@playwright/test'
import {
  runCanonicalDashedOutsideSourceJoinMatrixCase,
  runCanonicalDashedOutsideSourceJoinReviewCase
} from './stroke-canonical-matrix-utils'

test.describe.configure({ mode: 'serial' })

const caseDef = {
  key: 'dashed-outside-butt-bevel-join',
  joinType: 'bevel' as const
}

test('canonical stroke matrix: dashed outside source vertex bevel join', async (
  { page },
  testInfo
) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedOutsideSourceJoinMatrixCase(page, caseDef)
})

test('canonical stroke matrix: dashed outside source vertex bevel join closeups', async (
  { page },
  testInfo
) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedOutsideSourceJoinReviewCase(page, caseDef)
})
