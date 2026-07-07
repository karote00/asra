import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildSolidCenterStrokeRenderEntriesFromRenderPackets,
  emitSolidCenterStrokeProductOutputPacketsFromFinalFaces
} from '../../components/stroke-render/solid-center-stroke-packets'
import { projectSolidCenterStrokeRenderEntries } from '../../components/stroke-render/solid-center-stroke-render'
import {
  buildStrokeRuntimeRevisionSet,
  computeStrokeDirtyKeys
} from '../../components/stroke-render/stroke-dirty-keys'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'

interface InspectorRoute {
  id: string
  skipSteps: string[]
  resumeAt: string
  nextConsumer: string
  consumes: string[]
  produces: string[]
  forbiddenContributors: string[]
}

interface InspectorData {
  conditionalRoutes: InspectorRoute[]
  inspectorContractErrors: string[]
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)

const points = [
  { x: 0, y: 0 },
  { x: 80, y: 0 },
  { x: 80, y: 60 }
]

const polygon = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 10 },
  { x: 0, y: 10 }
]

const bounds = {
  minX: 0,
  minY: 0,
  maxX: 40,
  maxY: 10
}

const baseStroke = {
  visible: true,
  style: 'solid',
  position: 'outside',
  width: 12,
  join: 'miter',
  miterLimit: 4,
  cap: 'butt',
  dash: 0,
  gap: 0,
  kind: 'solid',
  color: 0x777777,
  alpha: 1,
  paintKey: 'solid:777777:1'
}

let cachedInspectorData: InspectorData | null = null

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  cachedInspectorData = data as InspectorData
  return cachedInspectorData
}

const routeById = (id: string) => {
  const data = loadInspectorData()
  const route = data.conditionalRoutes.find((entry) => entry.id === id)
  expect(data.inspectorContractErrors).toEqual([])
  expect(route, id).toBeDefined()
  return route as InspectorRoute
}

const buildRevisionSet = (
  strokeOverrides: Partial<typeof baseStroke> = {},
  pointOverrides = points
) =>
  buildStrokeRuntimeRevisionSet({
    points: pointOverrides,
    closed: true,
    stroke: {
      ...baseStroke,
      ...strokeOverrides
    },
    productMode: 'constrained-solid',
    domainMode: 'closed-constrained-domain',
    ownerKey: 'owner:bypass-cache',
    networkId: 'network:bypass-cache',
    strokeId: 'stroke:bypass-cache',
    ownerCount: 1
  })

describe('new stroke flow integration: bypass and cache routes', () => {
  it('routes paint-only changes to paint retint without re-entering geometry stages', () => {
    const route = routeById('paint-only-cache-retint')
    const base = buildRevisionSet()
    const paintOnly = buildRevisionSet({
      color: 0xff0000,
      paintKey: 'solid:red:1'
    })
    const dirty = computeStrokeDirtyKeys(base, paintOnly)

    expect(route).toMatchObject({
      resumeAt: 'attach-paint-payload',
      nextConsumer: 'attach-paint-payload',
      consumes: ['stage:stage-product-cache', 'dirty:paint-only'],
      produces: ['stage:attach-paint-payload', 'cache:paint-retint']
    })
    expect(route.skipSteps).toEqual(
      expect.arrayContaining([
        'normalize-stroke-spec',
        'resolve-stroke-domains',
        'allocate-dash-intervals',
        'build-source-vertex-join-products',
        'apply-legality',
        'build-resolved-stroke-regions'
      ])
    )
    expect(route.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'source topology rebuild',
        'domain rebuild',
        'dash interval allocation rebuild',
        'terminal cap rebuild',
        'join/miter rebuild'
      ])
    )
    expect(dirty.changedRevisionKeys).toEqual(['paintRevision'])
    expect(dirty.dirtyKeys).toEqual(['paint-payload', 'render-hit-export'])
  })

  it('classifies source drag as source/topology dirty without paint or static stroke dirtying', () => {
    const route = routeById('source-drag-dirty-classification')
    const base = buildRevisionSet()
    const dragged = buildRevisionSet({}, [
      { x: 0, y: 0 },
      { x: 90, y: 0 },
      { x: 80, y: 60 }
    ])
    const dirty = computeStrokeDirtyKeys(base, dragged)

    expect(route).toMatchObject({
      resumeAt: 'stage-product-cache',
      nextConsumer: 'stage-product-cache',
      consumes: ['stage:dirty-revision-graph', 'dirty:source-drag'],
      produces: ['stage:stage-product-cache', 'dirty:source-topology']
    })
    expect(route.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'static stroke parameter dirtying',
        'paint dirtying',
        'render-only drag approximation'
      ])
    )
    expect(dirty.dirtyKeys).toEqual(
      expect.arrayContaining([
        'path-topology',
        'shared-geometry',
        'domain-plan',
        'stroke-product',
        'render-hit-export'
      ])
    )
    expect(dirty.dirtyKeys).not.toContain('paint-payload')
    expect(dirty.changedRevisionKeys).not.toContain('paintRevision')
    expect(dirty.changedRevisionKeys).not.toContain('strokeSpecRevision')
  })

  it('routes hidden output to empty packet channels without visible geometry', () => {
    const route = routeById('hidden-output-cache-bypass')
    const packets = emitSolidCenterStrokeProductOutputPacketsFromFinalFaces([])

    expect(route).toMatchObject({
      resumeAt: 'emit-render-hit-export-packets',
      nextConsumer: 'emit-render-hit-export-packets',
      consumes: ['stage:stage-product-cache', 'dirty:visibility-hidden'],
      produces: [
        'stage:emit-render-hit-export-packets',
        'output:hidden-render-packets'
      ]
    })
    expect(route.skipSteps).toEqual(
      expect.arrayContaining([
        'build-center-stroke-products',
        'build-constrained-solid-products',
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-final-faces',
        'materialize-stroke-product-descriptors'
      ])
    )
    expect(route.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'visible product geometry',
        'diagnostic/helper visible geometry',
        'stale render entries'
      ])
    )
    expect(packets).toEqual({
      renderPackets: [],
      hitTestPackets: [],
      exportPackets: [],
      diagnosticPackets: []
    })
  })

  it('routes verified descriptor cache hits from final faces through normal output channels', () => {
    const route = routeById('verified-product-descriptor-cache-hit')
    const [finalFace] = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:cache-hit',
          polygons: [polygon],
          bounds,
          debugMeta: {
            routeId: 'verified-product-descriptor-cache-hit',
            ownerStage: 'Product Output final face cache hit',
            ownerKey: 'owner:cache-hit',
            strokeId: 'stroke:cache-hit',
            productMode: 'post-legality-product',
            productSignature: 'cache-hit-signature',
            visibleContributor: 'dash-interval-body',
            geometryBasis: 'post-legality-product'
          }
        },
        paint: {
          geometryId: 'geometry:cache-hit',
          kind: 'solid',
          color: 0x777777,
          alpha: 1,
          paintKey: 'solid:777777:1'
        }
      }
    ])
    const packets = emitSolidCenterStrokeProductOutputPacketsFromFinalFaces([
      finalFace
    ])
    const renderEntries = buildSolidCenterStrokeRenderEntriesFromRenderPackets(
      packets.renderPackets
    )
    const projections = projectSolidCenterStrokeRenderEntries(renderEntries)

    expect(route).toMatchObject({
      resumeAt: 'build-final-faces',
      nextConsumer: 'build-final-faces',
      consumes: [
        'stage:stage-product-cache',
        'cache:verified-product-descriptor'
      ],
      produces: ['stage:build-final-faces', 'cache:final-face-input']
    })
    expect(route.skipSteps).toEqual(
      expect.arrayContaining([
        'normalize-stroke-spec',
        'resolve-source-families',
        'allocate-dash-intervals',
        'build-source-vertex-join-products',
        'apply-legality',
        'attach-paint-payload'
      ])
    )
    expect(route.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'stale descriptor',
        'render-only cache reuse',
        'preview-only product output'
      ])
    )
    expect(packets.renderPackets).toHaveLength(1)
    expect(packets.hitTestPackets).toHaveLength(1)
    expect(packets.exportPackets).toHaveLength(1)
    expect(renderEntries[0]).toMatchObject({
      channel: 'render-entry',
      visibility: 'visible',
      evidenceChannel: {
        descriptorProductPolygonsVisible: false,
        reason: 'canonical-visible-product'
      }
    })
    expect(projections[0]).toMatchObject({
      channel: 'renderer-projection',
      visibility: 'visible-pixels',
      drawRouteType: 'masked-solid',
      metadataMutation: false
    })
  })
})
