import { expect, test } from '@playwright/test'

test('a short embedded viewport keeps contact feedback compact until explicitly expanded', async ({
  page
}, info) => {
  await page.setViewportSize({ width: 600, height: 700 })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page
    .getByLabel('Experiment', { exact: true })
    .selectOption({ label: 'Tool and table collision - r1' })
  await page.getByLabel('Sampled trajectory preview time').fill('4')

  const feedback = page.getByTestId('playback-feedback')

  await expect(feedback).toContainText('Collision detected')
  await expect
    .poll(async () => (await feedback.boundingBox())?.height ?? Infinity)
    .toBeLessThan(100)
  await page.screenshot({ path: info.outputPath('compact-contact.png') })
  await feedback.getByText('Details', { exact: true }).click()
  await expect(
    feedback.getByText('gripper - fixture table').last()
  ).toBeVisible()
})
