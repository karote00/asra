import { test } from '@playwright/test'
import { runCanonicalSolidCase } from './stroke-canonical-matrix-utils'

test('canonical stroke matrix: solid inside bevel', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await runCanonicalSolidCase(page, {
    key: 'solid-inside-bevel',
    position: 'inside',
    joinType: 'bevel'
  })
})
