import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConfigEnv, UserConfigExport } from 'vite'
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

describe('Vite configuration origin ownership', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  async function loadAppConfig(environment: ConfigEnv) {
    const { default: config }: { default: UserConfigExport } =
      await import('../../../vite.config')
    return typeof config === 'function' ? config(environment) : config
  }

  it.each(['', 'https://example.com'])(
    'builds static output without a usable server origin (%j)',
    async (origin) => {
      // An explicit empty value also prevents a developer's .env from masking CI.
      vi.stubEnv('APP_URL', origin)
      const config = await loadAppConfig({
        command: 'build',
        mode: 'production'
      })
      expect(config.base).toBe('./')
      expect(config.build?.target).toBe('es2022')
      expect(config.worker?.format).toBe('es')
      expect(config.server).toBeUndefined()
      expect(config.preview).toBeUndefined()
    }
  )

  describe.each([
    { mode: 'development', isPreview: false },
    { mode: 'production', isPreview: true }
  ])('serve with $mode mode and preview=$isPreview', (environment) => {
    it('requires an explicit server origin', async () => {
      vi.stubEnv('APP_URL', '')
      await expect(
        loadAppConfig({ command: 'serve', ...environment })
      ).rejects.toThrow('Set APP_URL')
    })

    it('rejects a non-local origin', async () => {
      vi.stubEnv('APP_URL', 'https://example.com')
      await expect(
        loadAppConfig({ command: 'serve', ...environment })
      ).rejects.toThrow('local HTTP')
    })

    it('uses the configured host and strict port', async () => {
      vi.stubEnv('APP_URL', 'http://127.0.0.1:3020')
      const config = await loadAppConfig({ command: 'serve', ...environment })
      const server = { host: '127.0.0.1', port: 3020, strictPort: true }
      expect(config.server).toEqual(server)
      expect(config.preview).toEqual(server)
    })
  })
})
