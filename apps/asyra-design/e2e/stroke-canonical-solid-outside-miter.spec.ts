import { test } from '@playwright/test'
import { runCanonicalSolidCase } from './stroke-canonical-matrix-utils'

test('canonical stroke matrix: solid outside miter', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalSolidCase(page, {
    key: 'solid-outside-miter',
    position: 'outside',
    joinType: 'miter'
  })
})
