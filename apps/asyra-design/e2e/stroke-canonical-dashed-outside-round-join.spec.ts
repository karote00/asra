import { test } from '@playwright/test'
import { runCanonicalDashedOutsideSourceJoinCase } from './stroke-canonical-matrix-utils'

test('canonical stroke matrix: dashed outside source vertex round join', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedOutsideSourceJoinCase(page, {
    key: 'dashed-outside-butt-round-join',
    joinType: 'round'
  })
})
