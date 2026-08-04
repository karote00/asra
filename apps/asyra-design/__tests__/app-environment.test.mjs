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

test('project defaults load without overwriting an explicit app URL', () => {
  const environment = {
    APP_URL: 'http://localhost:4555'
  }

  loadEnvironment(environment)

  assert.equal(environment.APP_URL, 'http://localhost:4555')
  assert.equal(typeof environment.VITE_COLLABORATION_WS_URL, 'string')
})

test('legacy parallel base URL variables do not replace the app URL owner', () => {
  assert.throws(
    () =>
      resolveEnvironment({
        VISUAL_REVIEW_BASE_URL: 'http://localhost:3000',
        PLAYWRIGHT_TEST_BASE_URL: 'http://localhost:3000'
      }),
    /APP_URL/
  )
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
