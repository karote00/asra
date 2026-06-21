import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import Clipper2ZFactory from 'clipper2-wasm'
import {
  createClipper2GeometryBackendRegistration,
  createClipper2GeometryBackend,
  loadClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'
import {
  createGeometryBackendRegistry,
  getGeometryBackendCacheSignature
} from '../components/stroke-render/geometry-backend'
import { buildArrangedStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-candidate-arrangement'
import type { SolidCenterStrokeResolvedPacket } from '../components/stroke-render/solid-center-stroke-packets'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')

const loadClipperModule = async () =>
  (await (
    Clipper2ZFactory as (options: {
      wasmBinary: Uint8Array
    }) => Promise<Clipper2Module>
  )({
    wasmBinary: readFileSync(wasmPath)
  })) as Clipper2Module

describe('clipper2 geometry backend adapter', () => {
  it('should run: load and register a preloaded Clipper2 backend without product helper imports', async () => {
    const backend = await loadClipper2GeometryBackend({
      factoryOptions: {
        wasmBinary: readFileSync(wasmPath)
      }
    })
    const registry = createGeometryBackendRegistry()

    registry.register(createClipper2GeometryBackendRegistration(backend))
    registry.select('clipper2-wasm')

    expect(registry.resolve()).toBe(backend)
  })

  it('should run: expose deterministic backend metadata and cache signature', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())

    expect(backend.backendId).toBe('clipper2-wasm')
    expect(backend.backendVersion).toBe('clipper2-wasm@0.2.1')
    expect(backend.capabilities).toEqual({
      union: true,
      difference: true,
      intersection: true,
      offset: true,
      buildArrangement: true
    })
    expect(getGeometryBackendCacheSignature(backend)).toBe(
      'clipper2-wasm@clipper2-wasm@0.2.1@scale:1000000@round:round@epsilon:0.000001'
    )
  })

  it('should run: perform exact boolean union, difference, and intersection through Clipper2', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const left = {
      polygons: [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ]
      ]
    }
    const right = {
      polygons: [
        [
          { x: 5, y: 0 },
          { x: 15, y: 0 },
          { x: 15, y: 10 },
          { x: 5, y: 10 }
        ]
      ]
    }

    const union = backend.union([left, right], 'nonzero')
    const difference = backend.difference([left], [right], 'nonzero')
    const intersection = backend.intersection([left], [right], 'nonzero')

    expect(union).toHaveLength(1)
    expect(union[0]?.polygons).toHaveLength(1)
    expect(union[0]?.polygons[0]).toEqual([
      { x: 10, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 10 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 }
    ])
    expect(difference[0]?.polygons[0]).toEqual([
      { x: 5, y: 0 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 }
    ])
    expect(intersection[0]?.polygons[0]).toEqual([
      { x: 10, y: 10 },
      { x: 5, y: 10 },
      { x: 5, y: 0 },
      { x: 10, y: 0 }
    ])
  })

  it('should run: reuse backend operation cache without leaking mutable output', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const square = {
      polygons: [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ]
      ]
    }

    const first = backend.union([square], 'nonzero')
    const firstPoint = first[0]?.polygons[0]?.[0]
    expect(firstPoint).toBeDefined()
    if (!firstPoint) {
      throw new Error('Expected first union point for cache immutability probe')
    }
    firstPoint.x = 999

    const second = backend.union([square], 'nonzero')

    expect(second[0]?.polygons[0]?.[0]?.x).not.toBe(999)
  })

  it('should run: offset closed and open paths through Clipper2', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const closedOffset = backend.offset(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      2,
      {
        width: 4,
        join: 'miter',
        cap: 'butt',
        closed: true,
        miterLimit: 4,
        fillRule: 'evenodd'
      }
    )
    const openOffset = backend.offset(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      2,
      {
        width: 4,
        join: 'round',
        cap: 'round',
        closed: false,
        miterLimit: 4,
        fillRule: 'evenodd'
      }
    )

    expect(closedOffset[0]?.polygons[0]?.length).toBeGreaterThanOrEqual(4)
    expect(openOffset[0]?.polygons[0]?.length).toBeGreaterThan(4)
  })

  it('should run: partition overlapping candidates into disjoint arrangement faces with owner claims', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const left = {
      candidateId: 'candidate:left',
      visualPacketKey: 'visual:left',
      strokePosition: 'inside' as const,
      ownerKey: 'owner:left',
      sourceSpanIds: ['span:left'],
      geometry: {
        polygons: [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ]
        ]
      }
    }
    const right = {
      candidateId: 'candidate:right',
      visualPacketKey: 'visual:right',
      strokePosition: 'inside' as const,
      ownerKey: 'owner:right',
      sourceSpanIds: ['span:right'],
      geometry: {
        polygons: [
          [
            { x: 5, y: 0 },
            { x: 15, y: 0 },
            { x: 15, y: 10 },
            { x: 5, y: 10 }
          ]
        ]
      }
    }

    const faces = backend.buildArrangement([left, right])
    const claimSignatures = faces
      .map((face) =>
        face.claimedBy.map((candidate) => candidate.candidateId).join('+')
      )
      .sort()

    expect(faces).toHaveLength(3)
    expect(claimSignatures).toEqual([
      'candidate:left',
      'candidate:left+candidate:right',
      'candidate:right'
    ])
    expect(
      faces.every(
        (face) =>
          face.legalState.insideFillDomain === true &&
          face.legalState.outsideFillDomain === true
      )
    ).toBe(true)
  })

  it('should run: normalize one candidate region before arrangement so one dash does not render internal strip seams', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const faces = backend.buildArrangement([
      {
        candidateId: 'candidate:single-dash',
        visualPacketKey: 'visual:single-dash',
        strokePosition: 'inside',
        ownerKey: 'owner:single-dash',
        sourceSpanIds: ['span:a', 'span:b'],
        geometry: {
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 4 },
              { x: 0, y: 4 }
            ],
            [
              { x: 8, y: 0 },
              { x: 18, y: 0 },
              { x: 18, y: 4 },
              { x: 8, y: 4 }
            ]
          ]
        }
      }
    ])

    expect(faces).toHaveLength(1)
    expect(
      faces[0]?.claimedBy.map((candidate) => candidate.candidateId)
    ).toEqual(['candidate:single-dash'])
    expect(faces[0]?.geometry.polygons).toHaveLength(1)
  })

  it('should run: clip arranged inside faces to the source legal domain with the exact backend', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const packet: SolidCenterStrokeResolvedPacket = {
      geometry: {
        geometryId: 'candidate:inside-crossing-domain',
        polygons: [
          [
            { x: -5, y: 0 },
            { x: 15, y: 0 },
            { x: 15, y: 10 },
            { x: -5, y: 10 }
          ]
        ],
        bounds: { minX: -5, minY: 0, maxX: 15, maxY: 10 },
        debugMeta: {
          sourcePathId: 'source:inside-crossing-domain',
          ownerKey: 'owner:inside-crossing-domain',
          strokeId: 'stroke:0',
          strokeIndex: 0,
          intervalId: 'interval:0',
          productMode: 'closed-constrained-domain',
          productSignature: 'constrained-dashed:domain-plan-selected-side',
          domainMode: 'closed-constrained-domain',
          topologyFamily: 'self-intersecting',
          strokePosition: 'inside'
        }
      },
      paint: {
        geometryId: 'candidate:inside-crossing-domain',
        color: 0xff0000,
        alpha: 0.5,
        paintKey: 'paint:red'
      }
    }

    const faces = buildArrangedStrokeFinalFacesFromResolvedPackets([packet], {
      backend,
      legalDomains: [
        {
          fillRule: 'evenodd',
          regions: [
            {
              polygons: [
                [
                  { x: 0, y: 0 },
                  { x: 10, y: 0 },
                  { x: 10, y: 10 },
                  { x: 0, y: 10 }
                ]
              ]
            }
          ]
        }
      ]
    })

    expect(faces).toHaveLength(1)
    expect(faces[0]?.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10
    })
    expect(faces[0]?.debugMeta).toMatchObject({
      arrangementStatus: 'exact',
      arrangementLegalState: {
        insideFillDomain: true,
        outsideFillDomain: false
      },
      productMode: 'closed-constrained-domain'
    })
  })

  it('should run: collapse same-visual arrangement overlap while preserving different visual separation', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const faces = backend.buildArrangement([
      {
        candidateId: 'candidate:a',
        visualPacketKey: 'visual:shared',
        strokePosition: 'inside',
        ownerKey: 'owner:a',
        sourceSpanIds: ['span:a'],
        geometry: {
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 }
            ]
          ]
        }
      },
      {
        candidateId: 'candidate:b',
        visualPacketKey: 'visual:shared',
        strokePosition: 'inside',
        ownerKey: 'owner:b',
        sourceSpanIds: ['span:b'],
        geometry: {
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 }
            ]
          ]
        }
      }
    ])

    expect(faces).toHaveLength(1)
    expect(
      faces[0]?.claimedBy.map((candidate) => candidate.candidateId)
    ).toEqual(['candidate:a', 'candidate:b'])
  })

  it('should run: partition self-intersecting dash candidates into shared and owner-specific arrangement faces', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const faces = backend.buildArrangement([
      {
        candidateId: 'candidate:self-intersection:span-a',
        visualPacketKey: 'visual:self-intersection',
        strokePosition: 'inside',
        ownerKey: 'owner:stroke',
        sourceSpanIds: ['span:a'],
        geometry: {
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 30, y: 0 },
              { x: 30, y: 8 },
              { x: 0, y: 8 }
            ]
          ]
        }
      },
      {
        candidateId: 'candidate:self-intersection:span-b',
        visualPacketKey: 'visual:self-intersection',
        strokePosition: 'inside',
        ownerKey: 'owner:stroke',
        sourceSpanIds: ['span:b'],
        geometry: {
          polygons: [
            [
              { x: 11, y: -8 },
              { x: 19, y: -8 },
              { x: 19, y: 16 },
              { x: 11, y: 16 }
            ]
          ]
        }
      }
    ])
    const claimSignatures = faces
      .map((face) =>
        face.claimedBy.map((candidate) => candidate.candidateId).join('+')
      )
      .sort()

    expect(faces).toHaveLength(3)
    expect(claimSignatures).toEqual([
      'candidate:self-intersection:span-a',
      'candidate:self-intersection:span-a+candidate:self-intersection:span-b',
      'candidate:self-intersection:span-b'
    ])
  })

  it('should run: partition high-curvature self-overlap candidates before duplicate-face collapse', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const faces = backend.buildArrangement([
      {
        candidateId: 'candidate:high-curvature:interval-a',
        visualPacketKey: 'visual:high-curvature',
        strokePosition: 'inside',
        ownerKey: 'owner:stroke',
        sourceSpanIds: ['span:a'],
        geometry: {
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 26, y: 0 },
              { x: 22, y: 18 },
              { x: 3, y: 18 }
            ]
          ]
        }
      },
      {
        candidateId: 'candidate:high-curvature:interval-b',
        visualPacketKey: 'visual:high-curvature',
        strokePosition: 'inside',
        ownerKey: 'owner:stroke',
        sourceSpanIds: ['span:b'],
        geometry: {
          polygons: [
            [
              { x: 12, y: -6 },
              { x: 33, y: 8 },
              { x: 26, y: 26 },
              { x: 8, y: 14 }
            ]
          ]
        }
      }
    ])
    const sharedFaces = faces.filter((face) => face.claimedBy.length === 2)
    const ownerSpecificFaces = faces.filter(
      (face) => face.claimedBy.length === 1
    )

    expect(sharedFaces.length).toBeGreaterThan(0)
    expect(ownerSpecificFaces.length).toBeGreaterThan(0)
    expect(faces.every((face) => face.geometry.polygons.length > 0)).toBe(true)
  })

  it('should run: reuse arrangement cache with the current candidate objects', async () => {
    const backend = createClipper2GeometryBackend(await loadClipperModule())
    const makeCandidate = (label: string) => ({
      candidateId: 'candidate:shared',
      visualPacketKey: `visual:${label}`,
      strokePosition: 'inside' as const,
      ownerKey: `owner:${label}`,
      sourceSpanIds: [`span:${label}`],
      geometry: {
        polygons: [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ]
        ]
      }
    })

    const firstCandidate = makeCandidate('a')
    const first = backend.buildArrangement([firstCandidate])
    const firstPoint = first[0]?.geometry.polygons[0]?.[0]
    expect(firstPoint).toBeDefined()
    if (!firstPoint) {
      throw new Error(
        'Expected first arrangement point for cache immutability probe'
      )
    }
    firstPoint.x = 999

    const secondCandidate = makeCandidate('a')
    const second = backend.buildArrangement([secondCandidate])

    expect(second[0]?.geometry.polygons[0]?.[0]?.x).not.toBe(999)
    expect(second[0]?.claimedBy[0]).toBe(secondCandidate)
  })
})
