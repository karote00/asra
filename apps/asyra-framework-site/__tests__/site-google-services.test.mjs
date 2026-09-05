import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'
import vm from 'node:vm'
import {
  googleAnalyticsBootstrap,
  resolveGoogleSiteServices
} from '../lib/site-google-services.mjs'

const configured = {
  VERCEL_ENV: 'production',
  NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123456',
  GOOGLE_SITE_VERIFICATION: 'test-verification-token'
}

test('only a configured production site enables Google services', () => {
  assert.deepEqual(resolveGoogleSiteServices({}), {})
  assert.deepEqual(
    resolveGoogleSiteServices({ ...configured, VERCEL_ENV: 'preview' }),
    {}
  )
  assert.deepEqual(
    resolveGoogleSiteServices({ ...configured, VERCEL_ENV: 'development' }),
    {}
  )
  assert.deepEqual(resolveGoogleSiteServices({ VERCEL_ENV: 'production' }), {})
  assert.deepEqual(resolveGoogleSiteServices(configured), {
    measurementId: 'G-TEST123456',
    verification: 'test-verification-token'
  })
  assert.deepEqual(
    resolveGoogleSiteServices({
      VERCEL_ENV: 'production',
      GOOGLE_SITE_VERIFICATION: configured.GOOGLE_SITE_VERIFICATION
    }),
    { verification: configured.GOOGLE_SITE_VERIFICATION }
  )
})

test('invalid production identifiers fail instead of injecting scripts', () => {
  for (const value of [
    'UA-123-1',
    'GTM-123456',
    'G-123";alert(1)//',
    '</script>'
  ]) {
    assert.throws(
      () =>
        resolveGoogleSiteServices({
          ...configured,
          NEXT_PUBLIC_GA_MEASUREMENT_ID: value
        }),
      /measurement ID/
    )
    assert.throws(() => googleAnalyticsBootstrap(value), /measurement ID/)
  }
  assert.throws(
    () =>
      resolveGoogleSiteServices({
        ...configured,
        GOOGLE_SITE_VERIFICATION: '<meta content="bad">'
      }),
    /verification token/
  )
})

test('the bootstrap initializes the official queue once without advertising signals', () => {
  const sandbox = {}
  sandbox.window = sandbox
  const script = googleAnalyticsBootstrap(
    configured.NEXT_PUBLIC_GA_MEASUREMENT_ID
  )
  vm.runInNewContext(script, sandbox)
  const events = Array.from(sandbox.dataLayer, (entry) => Array.from(entry))
  assert.equal(events[0][0], 'js')
  assert.equal(events[1][0], 'config')
  assert.equal(events[1][1], configured.NEXT_PUBLIC_GA_MEASUREMENT_ID)
  assert.equal(events[1][2].allow_google_signals, false)
  assert.equal(events[1][2].allow_ad_personalization_signals, false)
  assert.equal(events.length, 2)
  // The stream's enhanced history measurement is the sole SPA page-view owner.
  assert.equal(
    events.some(([type]) => type === 'event'),
    false
  )
})

test('the site build receives Google and indexing settings through Turbo', async () => {
  const turbo = JSON.parse(
    await readFile(new URL('../turbo.json', import.meta.url), 'utf8')
  )
  const task = turbo.tasks['build:asyra-framework-site']
  for (const key of [
    'VERCEL_ENV',
    'NEXT_PUBLIC_GA_MEASUREMENT_ID',
    'GOOGLE_SITE_VERIFICATION'
  ]) {
    assert.ok(task.env.includes(key), key)
  }
})
