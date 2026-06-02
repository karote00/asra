import { test } from '@playwright/test'
import { runCanonicalDashedCase } from './stroke-canonical-matrix-utils'

test('canonical stroke matrix: dashed outside butt', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedCase(page, {
    key: 'dashed-outside-butt',
    position: 'outside',
    capType: 'butt'
  })
})
