import { test } from '@playwright/test'
import { runCanonicalSolidCase } from './stroke-canonical-matrix-utils'

test('canonical stroke matrix: solid inside round', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalSolidCase(page, {
    key: 'solid-inside-round',
    position: 'inside',
    joinType: 'round'
  })
})
