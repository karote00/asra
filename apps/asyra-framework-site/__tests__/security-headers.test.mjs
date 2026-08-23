import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'

const readPolicy = async (environment) => {
  const originalEnvironment = process.env.NODE_ENV
  process.env.NODE_ENV = environment

  try {
    const { default: config } = await import(
      `../next.config.ts?environment=${environment}`
    )
    const routes = await config.headers()
    const policy = routes[0].headers.find(
      ({ key }) => key === 'Content-Security-Policy'
    )

    return policy.value
  } finally {
    if (originalEnvironment === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalEnvironment
    }
  }
}

test('development CSP supports React debugging without weakening production', async () => {
  const developmentPolicy = await readPolicy('development')
  const productionPolicy = await readPolicy('production')

  assert.match(developmentPolicy, /script-src[^;]*'unsafe-eval'/)
  assert.doesNotMatch(productionPolicy, /script-src[^;]*'unsafe-eval'/)
})
