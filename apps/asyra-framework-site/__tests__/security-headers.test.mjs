import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'

const readPolicy = async (environment, gaEnvironment) => {
  const originalEnvironment = process.env.NODE_ENV
  const originalVercel = process.env.VERCEL_ENV
  const originalGa = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  process.env.NODE_ENV = environment
  process.env.VERCEL_ENV = gaEnvironment ?? 'development'
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST123456'

  try {
    const { default: config } = await import(
      `../next.config.ts?environment=${environment}&ga=${gaEnvironment}`
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
    if (originalVercel === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = originalVercel
    if (originalGa === undefined)
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = originalGa
  }
}

test('development CSP supports React debugging without weakening production', async () => {
  const developmentPolicy = await readPolicy('development')
  const productionPolicy = await readPolicy('production')

  assert.match(developmentPolicy, /script-src[^;]*'unsafe-eval'/)
  assert.doesNotMatch(productionPolicy, /script-src[^;]*'unsafe-eval'/)
})

test('GA4 network sources are allowed only for configured production', async () => {
  const preview = await readPolicy('production', 'preview')
  const production = await readPolicy('production', 'production')
  assert.doesNotMatch(preview, /google/)
  assert.match(
    production,
    /script-src[^;]*https:\/\/www\.googletagmanager\.com/
  )
  assert.match(
    production,
    /connect-src[^;]*https:\/\/\*\.google-analytics\.com/
  )
  assert.match(
    production,
    /connect-src[^;]*https:\/\/\*\.analytics\.google\.com/
  )
  assert.match(production, /img-src[^;]*https:\/\/\*\.google-analytics\.com/)
  assert.doesNotMatch(production, /unsafe-eval|doubleclick|googlesyndication/)
})
