/* global document, window */
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { chromium, expect } = require('@playwright/test')
const { startServer } = require('../server.cjs')

test(
  'the live board verifies, exposes cross-flow failure, recovers, and retains snapshot identity',
  { timeout: 90000 },
  async () => {
    const root = path.resolve(__dirname, '../../../..')
    const parent = path.join(root, 'tmp/flow-inspector/visual-review')
    fs.mkdirSync(parent, { recursive: true })
    const artifacts = fs.mkdtempSync(path.join(parent, 'review-'))
    const temporary = path.join(artifacts, 'browser-tmp')
    fs.mkdirSync(temporary)
    const previousTemporary = process.env.TMPDIR
    process.env.TMPDIR = temporary
    const server = await startServer(root, {
      serviceOptions: { directory: path.join(artifacts, 'runs') }
    })
    let browser
    const screenshots = []
    try {
      browser = await chromium.launch({
        channel: process.env.FLOW_PROOF_BROWSER_CHANNEL || undefined,
        downloadsPath: temporary
      })
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1050 }
      })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(server.origin)
      await expect(page.locator('.step-card')).toHaveCount(6)
      await expect(
        page.locator('.step-card[data-status="unknown"]')
      ).toHaveCount(6)
      const originalCard = await page
        .locator('.step-card')
        .first()
        .elementHandle()
      const capture = async (name, locator) => {
        const file = path.join(artifacts, name + '.png')
        if (locator) await locator.screenshot({ path: file })
        else await page.screenshot({ path: file, fullPage: true })
        screenshots.push({
          file,
          url: page.url(),
          viewport: page.viewportSize(),
          attempt: await page.locator('#attempt-id').textContent(),
          digest: await page.locator('#source-digest').textContent()
        })
      }
      const run = async (
        scenario,
        status,
        button = page.locator('#run-all')
      ) => {
        const previous = await page.locator('#attempt-id').textContent()
        await page.locator('#scenario').selectOption(scenario)
        await button.click()
        await expect(page.locator('#attempt-id')).not.toHaveText(previous)
        await expect(page.locator('#run-state')).toHaveText('Ready to verify', {
          timeout: 20000
        })
        await expect(page.locator('#overall')).toHaveAttribute(
          'data-status',
          status
        )
        return page.locator('#attempt-id').textContent()
      }
      const baseline = await run('baseline', 'passed')
      await expect(page.locator('#checks')).toHaveText('6 / 6')
      await expect(
        page.locator('.step-card[data-status="passed"]')
      ).toHaveCount(6)
      await expect(page.locator('#source-digest')).toHaveText(/^[a-f0-9]{64}$/)
      const baselineDigest = await page.locator('#source-digest').textContent()
      await capture('desktop-baseline')
      const negative = await run('inverse-regression', 'failed')
      await expect(
        page.locator(
          '[data-flow="deferred-publication"] .step-card[data-status="passed"]'
        )
      ).toHaveCount(3)
      await expect(
        page.locator(
          '[data-flow="immediate-cancellation"] .step-card[data-status="failed"]'
        )
      ).toHaveCount(2)
      await expect(page.locator('#result-context')).toContainText(
        'NEGATIVE DEMONSTRATION'
      )
      const failedCard = page.locator(
        '[data-flow="immediate-cancellation"] [data-step="finalize-transaction-state"]'
      )
      await expect(failedCard.locator('.failure')).toContainText(
        'cancel.outcome - failed'
      )
      await expect(failedCard.locator('.failure')).toContainText(
        'AssertionError'
      )
      await capture('desktop-regression')
      await capture('failed-owner-card', failedCard)
      const recovery = await run('baseline', 'passed')
      await expect(page.locator('#source-digest')).toHaveText(baselineDigest)
      await page
        .getByRole('button', { name: /Regression demo - failed/ })
        .click()
      await expect(page.locator('#attempt-id')).toHaveText(negative)
      await expect(page.locator('#overall')).toHaveAttribute(
        'data-status',
        'failed'
      )
      await page
        .getByRole('button', { name: /Current source - passed/ })
        .first()
        .click()
      await expect(page.locator('#attempt-id')).toHaveText(recovery)
      await expect(page.locator('#overall')).toHaveAttribute(
        'data-status',
        'passed'
      )
      await page.locator('.shared').first().click()
      await expect(
        page.locator('.step-card[data-highlight="true"]')
      ).toHaveCount(2)
      await run(
        'baseline',
        'passed',
        page.locator('[data-flow="deferred-publication"] .step-run').first()
      )
      await expect(page.locator('#checks')).toHaveText('3 / 3')
      await expect(
        page.locator(
          '[data-flow="immediate-cancellation"] .step-card[data-status="unknown"]'
        )
      ).toHaveCount(3)
      const countBeforeRead = server.service.state().runs.length
      await page.locator('#refresh').click()
      await expect(page.locator('#run-state')).toHaveText('Ready to verify')
      assert.equal(server.service.state().runs.length, countBeforeRead)
      assert.equal(
        await originalCard.evaluate(
          (node) => node === document.querySelector('.step-card')
        ),
        true
      )
      // A pending cancellation must settle before the next button can run work.
      await page.locator('#run-all').click()
      await expect(page.locator('#cancel')).toBeEnabled()
      await page.locator('#cancel').click()
      await expect(page.locator('#run-state')).toHaveText('Ready to verify', {
        timeout: 20000
      })
      await expect(page.locator('#overall')).toHaveAttribute(
        'data-status',
        'unknown'
      )
      await run('baseline', 'passed')
      await page.setViewportSize({ width: 390, height: 844 })
      await capture('mobile-recovery')
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        ),
        true
      )
      assert.deepEqual(errors, [])
      fs.writeFileSync(
        path.join(artifacts, 'review.json'),
        JSON.stringify(
          {
            url: server.origin,
            command:
              'FLOW_PROOF_URL=http://127.0.0.1:4318 node --test tools/flow-inspector/control-plane/__tests__/board.test.cjs',
            baseline,
            negative,
            recovery,
            screenshots
          },
          null,
          2
        ) + '\n'
      )
      process.stdout.write('Visual review artifacts: ' + artifacts + '\n')
    } finally {
      await browser?.close()
      await server.close()
      if (previousTemporary === undefined) delete process.env.TMPDIR
      else process.env.TMPDIR = previousTemporary
    }
  }
)
