import { expect, it } from 'vitest'
import { resolveAppEnvironment } from '../../../app-environment.mjs'

it('uses one explicit local origin for server/test configuration', () => {
  expect(resolveAppEnvironment({ APP_URL: 'http://127.0.0.1:3020' })).toEqual({
    url: 'http://127.0.0.1:3020',
    host: '127.0.0.1',
    port: 3020
  })
  expect(() =>
    resolveAppEnvironment({ APP_URL: 'https://example.com' })
  ).toThrow('local HTTP')
  expect(() =>
    resolveAppEnvironment({ APP_URL: 'http://127.0.0.1:3020/path' })
  ).toThrow('local HTTP')
})
