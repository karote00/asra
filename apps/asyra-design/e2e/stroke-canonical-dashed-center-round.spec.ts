import { test } from '@playwright/test'
import { runCanonicalDashedCase } from './stroke-canonical-matrix-utils'

test('canonical stroke matrix: dashed center round', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedCase(page, {
    key: 'dashed-center-round',
    position: 'center',
    capType: 'round'
  })
})
