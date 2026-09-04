import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { encodeGlb, triangleFixture } from './fixtures'
import type { VisualAsset } from '../decode'

test('the production preview worker decodes GLB without Core, GPU initialization, or external requests', async ({
  page
}, testInfo) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/')
  const { json, binary } = triangleFixture(),
    bytes = encodeGlb(json, binary)
  const output = await page.evaluate(
    async ({ data, moduleUrl }) => {
      const { RestrictedGlbPreviewWorker } = await import(moduleUrl)
      const worker = new RestrictedGlbPreviewWorker(),
        start = performance.now(),
        timeoutController = new AbortController(),
        timeout = setTimeout(() => timeoutController.abort(), 5000)
      try {
        const asset: VisualAsset = await worker.decode(
          new Uint8Array(data),
          timeoutController.signal
        )
        return { asset, elapsedMs: performance.now() - start }
      } finally {
        clearTimeout(timeout)
        worker.dispose()
      }
    },
    {
      data: Array.from(bytes),
      moduleUrl: '/src/engine/glb/preview-worker.ts'
    }
  )
  expect(output.asset.meshes[0].positions).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
  expect(output.asset.source.sha256).toBe(
    createHash('sha256').update(bytes).digest('hex')
  )
  expect(
    requests.filter((url) => new URL(url).origin !== new URL(page.url()).origin)
  ).toEqual([])
  await testInfo.attach('asset-worker-feasibility', {
    contentType: 'application/json',
    body: JSON.stringify({ url: page.url(), ...output })
  })
})
