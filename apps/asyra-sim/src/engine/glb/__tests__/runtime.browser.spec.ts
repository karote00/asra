import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { encodeGlb, triangleFixture } from './fixtures'
import type { VisualAsset } from '../decode'

test('a local worker decodes GLB without Core, GPU initialization, or external requests', async ({
  page
}, testInfo) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/')
  const { json, binary } = triangleFixture(),
    bytes = encodeGlb(json, binary)
  const output = await page.evaluate(async (data) => {
    const worker = new Worker(
      '/src/engine/glb/__tests__/decode-proof.worker.ts',
      { type: 'module' }
    )
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      return await new Promise<{ asset: VisualAsset; elapsedMs: number }>(
        (resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Worker proof deadline exceeded')),
            5000
          )
          worker.onmessage = (event) =>
            event.data.error
              ? reject(new Error(event.data.error))
              : resolve(event.data)
          worker.onerror = (event) => reject(new Error(event.message))
          const buffer = new Uint8Array(data)
          worker.postMessage(buffer, [buffer.buffer])
        }
      )
    } finally {
      clearTimeout(timeout)
      worker.terminate()
    }
  }, Array.from(bytes))
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
