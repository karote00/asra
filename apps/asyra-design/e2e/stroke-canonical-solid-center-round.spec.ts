import { test } from '@playwright/test'
import { runCanonicalSolidCase } from './stroke-canonical-matrix-utils'

test('canonical stroke matrix: solid center round', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalSolidCase(page, {
    key: 'solid-center-round',
    position: 'center',
    joinType: 'round'
  })
})
