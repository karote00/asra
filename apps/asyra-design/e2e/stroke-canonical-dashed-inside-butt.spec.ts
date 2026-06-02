import { test } from '@playwright/test'
import { runCanonicalDashedCase } from './stroke-canonical-matrix-utils'

test('canonical stroke matrix: dashed inside butt', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalDashedCase(page, {
    key: 'dashed-inside-butt',
    position: 'inside',
    capType: 'butt'
  })
})
