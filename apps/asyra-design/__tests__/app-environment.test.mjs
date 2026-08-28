import assert from 'node:assert/strict'
import test from 'node:test'

import { loadEnvironment, resolveEnvironment } from '../app-environment.mjs'

test('one app URL configures a non-default Vite and Playwright port', () => {
  assert.deepEqual(
    resolveEnvironment({
      APP_URL: 'http://localhost:4317',
      COLLABORATION_WS_HOST: '127.0.0.1',
      COLLABORATION_WS_PORT: '5109'
    }),
    {
      appURL: 'http://localhost:4317',
      viteHost: 'localhost',
      vitePort: 4317,
      collaborationWebSocketHost: '127.0.0.1',
      collaborationWebSocketPort: 5109,
      collaborationHealthURL: 'http://127.0.0.1:5109/health'
    }
  )
})

test('a deployed HTTPS origin remains the single app URL', () => {
  const config = resolveEnvironment({
    APP_URL: 'https://design.example.com'
  })

  assert.equal(config.appURL, 'https://design.example.com')
  assert.equal(config.viteHost, 'design.example.com')
  assert.equal(config.vitePort, 443)
})

test('missing project environment uses safe development defaults without a browser socket override', () => {
  const environment = {}

  loadEnvironment(environment)

  assert.equal(environment.APP_URL, undefined)
  assert.equal(environment.VITE_COLLABORATION_WS_URL, undefined)
  assert.deepEqual(resolveEnvironment(environment), {
    appURL: 'http://localhost:3000',
    viteHost: 'localhost',
    vitePort: 3000,
    collaborationWebSocketHost: '127.0.0.1',
    collaborationWebSocketPort: 4101,
    collaborationHealthURL: 'http://127.0.0.1:4101/health'
  })
})

test('legacy parallel base URL variables do not replace the app URL owner', () => {
  const config = resolveEnvironment({
    VISUAL_REVIEW_BASE_URL: 'http://localhost:4555',
    PLAYWRIGHT_TEST_BASE_URL: 'http://localhost:4666'
  })

  assert.equal(config.appURL, 'http://localhost:3000')
  assert.equal(config.vitePort, 3000)
})

test('invalid app URL and collaboration port fail before startup', () => {
  assert.throws(
    () =>
      resolveEnvironment({
        APP_URL: 'ftp://design.example.com'
      }),
    /http or https/
  )
  assert.throws(
    () =>
      resolveEnvironment({
        APP_URL: 'http://localhost:3000',
        COLLABORATION_WS_PORT: '70000'
      }),
    /COLLABORATION_WS_PORT/
  )
})
