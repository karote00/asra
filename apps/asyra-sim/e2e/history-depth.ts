import type { Page } from '@playwright/test'

/** Assert edit deltas independently of how many starter records were created. */
export async function readHistoryDepth(page: Page): Promise<number> {
  const text = await page.getByTestId('history-depth').innerText()
  const match = /^Undo steps: (\d+)$/.exec(text)
  if (!match) throw new Error(`Unexpected history indicator: ${text}`)
  return Number(match[1])
}
