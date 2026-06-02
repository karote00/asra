import { test } from '@playwright/test'
import { runCanonicalDashedCase } from './stroke-canonical-matrix-utils'

test('canonical stroke matrix: dashed outside square', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedCase(page, {
    key: 'dashed-outside-square',
    position: 'outside',
    capType: 'square'
  })
})
