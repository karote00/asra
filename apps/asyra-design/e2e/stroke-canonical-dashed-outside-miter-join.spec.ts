import { test } from '@playwright/test'
import {
  runCanonicalDashedOutsideNoFillSourceJoinMatrixCase,
  runCanonicalDashedOutsideSourceJoinMatrixCase,
  runCanonicalDashedOutsideSourceJoinReviewCase
} from './stroke-canonical-matrix-utils'

test.describe.configure({ mode: 'serial' })

const caseDef = {
  key: 'dashed-outside-butt-miter-join',
  joinType: 'miter' as const
}

test('canonical stroke matrix: dashed outside source vertex miter join', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedOutsideSourceJoinMatrixCase(page, caseDef)
})

test('canonical stroke matrix: dashed outside source vertex miter join closeups', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedOutsideSourceJoinReviewCase(page, caseDef)
})

test('canonical stroke matrix: dashed outside source vertex miter join no-fill rule overlay', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedOutsideNoFillSourceJoinMatrixCase(page, caseDef)
})

test('canonical stroke matrix: dashed outside source vertex miter join no-fill polyline rule overlay', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedOutsideNoFillSourceJoinMatrixCase(page, {
    ...caseDef,
    sourceKind: 'polyline'
  })
})
