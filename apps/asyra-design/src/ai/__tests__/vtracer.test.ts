import { describe, expect, it, vi } from 'vitest'
import {
  VTRACER_ENDPOINT,
  VTracerError,
  createVTracerClient,
  parseVTracerSvg
} from '../vtracer'

const attachment = Object.freeze({
  dataUrl: 'data:image/png;base64,AQIDBA==',
  mediaType: 'image/png' as const,
  name: 'arbitrary-image.png',
  size: 4
})

const validSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="32">
    <path d="M0,0L64,0L64,32L0,32Z" fill="#FFFFFF"/>
    <path d="M8,8L24,8L24,24L8,24Z" fill="#2563EB"/>
    <path d="M1,1Z" fill="#000000"/>
  </svg>
`

describe('Asyra Design VTracer adapter', () => {
  it('validates VTracer polygon SVG into finite generic-role editable vectors', () => {
    const result = parseVTracerSvg(validSvg)

    expect(result).toMatchObject({
      height: 32,
      pointCount: 8,
      width: 64
    })
    expect(result.items).toEqual([
      {
        bounds: { height: 32, width: 64, x: 0, y: 0 },
        paths: [
          {
            closed: true,
            points: [
              { x: 0, y: 0 },
              { x: 64, y: 0 },
              { x: 64, y: 32 },
              { x: 0, y: 32 }
            ]
          }
        ],
        primitive: 'vector',
        role: 'reference-vector-000001',
        style: { fillColor: '#FFFFFF' }
      },
      {
        bounds: { height: 16, width: 16, x: 8, y: 8 },
        paths: [
          {
            closed: true,
            points: [
              { x: 8, y: 8 },
              { x: 24, y: 8 },
              { x: 24, y: 24 },
              { x: 8, y: 24 }
            ]
          }
        ],
        primitive: 'vector',
        role: 'reference-vector-000002',
        style: { fillColor: '#2563EB' }
      }
    ])
  })

  it('rejects unsupported, empty, or non-finite SVG before mutation', () => {
    const invalidSources = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><path d="M0,0C1,1,2,2,3,3Z" fill="#000000"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><path d="M0,0LInfinity,0L1,1Z" fill="#000000"/></svg>'
    ]

    invalidSources.forEach((source) => {
      expect(() => parseVTracerSvg(source)).toThrow(VTracerError)
    })
  })

  it('post-processes an oversized finite trace proportionally into the canonical workspace', () => {
    const result = parseVTracerSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="2048"><path d="M0,0L4096,0L4096,2048L0,2048Z" fill="#000000"/></svg>'
    )

    expect(result).toMatchObject({
      height: 1024,
      width: 2048
    })
    expect(result.items[0]).toMatchObject({
      bounds: { height: 1024, width: 2048, x: 0, y: 0 }
    })
  })

  it('validates a very high-point path without a JavaScript argument-count ceiling', () => {
    const topEdge = Array.from(
      { length: 130_000 },
      (_, index) => `L${index},0`
    ).join('')
    const result = parseVTracerSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="130000" height="2"><path d="M0,0${topEdge}L129999,2L0,2Z" fill="#000000"/></svg>`
    )

    expect(result.items).toHaveLength(1)
    expect(result.pointCount).toBe(130_003)
    expect(result.items[0]?.bounds).toMatchObject({
      height: expect.any(Number),
      width: expect.any(Number),
      x: 0,
      y: 0
    })
  })

  it('posts only attachment bytes to the same-origin tool and parses its SVG response', async () => {
    const fetchImplementation = vi.fn(async (_input, init) => {
      expect(init).toMatchObject({
        body: expect.any(Uint8Array),
        headers: {
          'content-type': 'image/png',
          'x-asyra-vtracer-profile': 'photo-faithful'
        },
        method: 'POST'
      })
      expect(Array.from(init?.body as Uint8Array)).toEqual([1, 2, 3, 4])
      return new Response(validSvg, {
        headers: { 'content-type': 'image/svg+xml' },
        status: 200
      })
    })
    const client = createVTracerClient({
      fetch: fetchImplementation
    })

    const result = await client.vectorize({
      attachment,
      profile: 'photo-faithful',
      signal: new AbortController().signal
    })

    expect(fetchImplementation).toHaveBeenCalledWith(
      VTRACER_ENDPOINT,
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    )
    expect(result.items).toHaveLength(2)
    expect(JSON.stringify(result)).not.toContain(attachment.dataUrl)
  })

  it('returns one stable tool error for a failed or malformed response', async () => {
    const failed = createVTracerClient({
      fetch: vi.fn(async () => new Response('failed', { status: 422 }))
    })
    const malformed = createVTracerClient({
      fetch: vi.fn(
        async () =>
          new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
            status: 200
          })
      )
    })
    const request = {
      attachment,
      profile: 'photo-faithful' as const,
      signal: new AbortController().signal
    }

    await expect(failed.vectorize(request)).rejects.toMatchObject({
      code: 'VTRACER_FAILED'
    })
    await expect(malformed.vectorize(request)).rejects.toBeInstanceOf(
      VTracerError
    )
  })
})
