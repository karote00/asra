import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  AsyraDesignVTracerServerError,
  convertAsyraDesignVTracerBuffer
} from '../vtracer-tool-server.mjs'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('the same-origin VTracer server converts a checked-in arbitrary PNG without native dependencies', async () => {
  const png = await readFile(path.join(appRoot, 'public/logo192.png'))
  const svg = await convertAsyraDesignVTracerBuffer({
    bytes: png,
    contentType: 'image/png',
    profile: 'photo-faithful',
    signal: new globalThis.AbortController().signal
  })

  assert.match(svg, /Generator: visioncortex VTracer 1\.0\.0-alpha\.1/)
  assert.match(svg, /<svg[^>]+width="192"[^>]+height="192"/)
  assert.ok((svg.match(/<path\b/g) ?? []).length > 100)
})

test('the server rejects unsupported content, profile, empty input, and pre-abort before conversion', async () => {
  const sources = [
    {
      bytes: new Uint8Array([1]),
      contentType: 'image/gif',
      profile: 'photo-faithful'
    },
    {
      bytes: new Uint8Array([1]),
      contentType: 'image/webp',
      profile: 'photo-faithful'
    },
    {
      bytes: new Uint8Array([1]),
      contentType: 'image/png',
      profile: 'unregistered'
    },
    {
      bytes: new Uint8Array(),
      contentType: 'image/png',
      profile: 'photo-faithful'
    }
  ]

  for (const source of sources) {
    await assert.rejects(
      convertAsyraDesignVTracerBuffer({
        ...source,
        signal: new globalThis.AbortController().signal
      }),
      AsyraDesignVTracerServerError
    )
  }

  const controller = new globalThis.AbortController()
  controller.abort('cancelled')
  await assert.rejects(
    convertAsyraDesignVTracerBuffer({
      bytes: new Uint8Array([1]),
      contentType: 'image/png',
      profile: 'photo-faithful',
      signal: controller.signal
    }),
    (error) => error?.code === 'ASYRA_DESIGN_VTRACER_ABORTED'
  )
})
