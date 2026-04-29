import type { SolidCenterStrokeResolvedPacket } from './solid-center-stroke-packets'
import {
  buildCenterDashedOverlapGraph,
  extractCenterDashedOverlapComponents,
  polygonsHavePositiveAreaOverlap,
  type CenterDashedOverlapCandidate,
  type Vec2
} from './center-dashed-overlap-graph'
import { buildCenterDashedOverlapCandidatesFromResolvedPackets } from './center-dashed-overlap-candidates'
import {
  resolveCenterDashedOwnershipForComponent,
  type CenterDashedOwnershipCandidate
} from './center-dashed-ownership'

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type BailoutReason =
  | 'overlay-instability'
  | 'numeric-instability'
  | 'owner-tie-unresolved'
  | 'illegal-domain-missing'

export type CenterDashedDebugMode = 'overlap' | 'ownership' | 'bailout' | 'all'

export interface CenterDashedOverlapComponentDiagnostic {
  componentId: string
  candidateIds: string[]
  bounds: Bounds
  polygons: Vec2[][]
}

export interface CenterDashedOwnershipRegionDiagnostic {
  regionId: string
  candidateIds: string[]
  ownerIntervalId: string
  ownerStrokeId: string
  ownerKey?: string
  networkId?: string
  ownerPrimitiveKind: 'body' | 'join' | 'cap'
  bounds: Bounds
  polygon: Vec2[]
}

export interface CenterDashedOwnershipBailoutDiagnostic {
  componentId: string
  reason: BailoutReason
  preservedOwnerKeys: string[]
  preservedPreviewIntervalIds: string[]
  preservedPreviewPolygons: Vec2[][]
}

export interface CenterDashedOwnershipDiagnostics {
  ownedRegions: CenterDashedOwnershipRegionDiagnostic[]
  passthroughIntervals: string[]
  unresolvedBailouts: CenterDashedOwnershipBailoutDiagnostic[]
}

export interface CenterDashedOverlapDiagnostics {
  candidates: CenterDashedOverlapCandidate[]
  edges: [string, string][]
  components: CenterDashedOverlapComponentDiagnostic[]
  ownership: CenterDashedOwnershipDiagnostics
}

export interface CenterDashedOverlapDiagnosticsRuntimeGraphic {
  __asyraCenterDashedOverlapDiagnostics?: CenterDashedOverlapDiagnostics
}

export interface CenterDashedDebugConfig {
  enabled?: boolean
  mode?: CenterDashedDebugMode
  forceBailoutReason?: BailoutReason
}

const ROUNDING_FACTOR = 1_000

const roundCoordinate = (value: number) =>
  Math.round(value * ROUNDING_FACTOR) / ROUNDING_FACTOR

const getDebugConfig = (): CenterDashedDebugConfig =>
  (
    globalThis as {
      __ASYRA_CENTER_DASHED_OVERLAP_DEBUG__?: CenterDashedDebugConfig
    }
  ).__ASYRA_CENTER_DASHED_OVERLAP_DEBUG__ ?? {}

const getBounds = (polygons: Vec2[][]): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygons.forEach((polygon) =>
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  )

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  return { minX, minY, maxX, maxY }
}

const candidateOverlapsPolygon = (
  candidate: CenterDashedOverlapCandidate,
  polygon: Vec2[]
) =>
  candidate.polygons.some((candidatePolygon) =>
    polygonsHavePositiveAreaOverlap(candidatePolygon, polygon)
  )

const createOwnershipCandidate = (
  candidate: CenterDashedOverlapCandidate
): CenterDashedOwnershipCandidate => ({
  candidateId: candidate.candidateId,
  intervalId: candidate.intervalId,
  strokeId: candidate.strokeId,
  ownerKey: candidate.ownerKey,
  networkId: candidate.networkId,
  primitiveKind: 'body',
  normalDistanceToSource: 0,
  startDistance: candidate.startDistance,
  authoredVisibleIntervalIndex: candidate.authoredVisibleIntervalIndex,
  stableIntervalId: candidate.candidateId,
  polygons: candidate.polygons,
  continuityPreserving:
    candidate.previousVisibleIntervalId !== null ||
    candidate.nextVisibleIntervalId !== null,
  regionInsideTerminalEnvelope: false
})

const buildRegionKey = (candidateIds: string[], bounds: Bounds) =>
  [
    candidateIds.join('|'),
    roundCoordinate(bounds.minX),
    roundCoordinate(bounds.minY),
    roundCoordinate(bounds.maxX),
    roundCoordinate(bounds.maxY)
  ].join(':')

const buildOwnershipRegionsForComponent = (
  componentCandidates: CenterDashedOverlapCandidate[]
) => {
  const regions = new Map<
    string,
    {
      regionId: string
      polygon: Vec2[]
      candidateIds: string[]
      candidates: CenterDashedOwnershipCandidate[]
    }
  >()

  componentCandidates.forEach((anchorCandidate) => {
    anchorCandidate.polygons.forEach((polygon, polygonIndex) => {
      const overlappingCandidates = componentCandidates.filter((candidate) =>
        candidateOverlapsPolygon(candidate, polygon)
      )

      if (overlappingCandidates.length < 2) {
        return
      }

      const candidateIds = overlappingCandidates
        .map(({ candidateId }) => candidateId)
        .sort((left, right) => left.localeCompare(right))
      const bounds = getBounds([polygon])
      const regionKey = buildRegionKey(candidateIds, bounds)

      if (!regions.has(regionKey)) {
        regions.set(regionKey, {
          regionId: `${anchorCandidate.candidateId}:region:${polygonIndex}`,
          polygon,
          candidateIds,
          candidates: overlappingCandidates.map(createOwnershipCandidate)
        })
      }
    })
  })

  return [...regions.values()].sort((left, right) =>
    left.regionId.localeCompare(right.regionId)
  )
}

const buildOwnershipDiagnostics = (
  components: CenterDashedOverlapComponentDiagnostic[],
  candidateById: Map<string, CenterDashedOverlapCandidate>,
  config: CenterDashedDebugConfig
): CenterDashedOwnershipDiagnostics => {
  const ownedRegions: CenterDashedOwnershipRegionDiagnostic[] = []
  const passthroughIntervals = new Set<string>()
  const unresolvedBailouts: CenterDashedOwnershipBailoutDiagnostic[] = []

  components.forEach((component) => {
    const componentCandidates = component.candidateIds
      .map((candidateId) => candidateById.get(candidateId))
      .filter(
        (candidate): candidate is CenterDashedOverlapCandidate => !!candidate
      )

    componentCandidates.forEach(({ intervalId }) => {
      passthroughIntervals.add(intervalId)
    })

    const regions = buildOwnershipRegionsForComponent(componentCandidates)
    if (regions.length === 0) {
      return
    }

    const ownership = resolveCenterDashedOwnershipForComponent({
      componentId: component.componentId,
      regions,
      forceBailoutReason: config.forceBailoutReason
    })

    ownership.passthroughIntervals.forEach((intervalId) => {
      passthroughIntervals.add(intervalId)
    })
    unresolvedBailouts.push(...ownership.unresolvedBailouts)
    ownedRegions.push(
      ...ownership.ownedRegions.map((region) => ({
        regionId: region.regionId,
        candidateIds:
          regions.find(
            (candidateRegion) => candidateRegion.regionId === region.regionId
          )?.candidateIds ?? [],
        ownerIntervalId: region.ownerIntervalId,
        ownerStrokeId: region.ownerStrokeId,
        ownerKey: region.ownerKey,
        networkId: region.networkId,
        ownerPrimitiveKind: region.ownerPrimitiveKind,
        bounds: region.bounds,
        polygon: region.polygon
      }))
    )
  })

  return {
    ownedRegions: ownedRegions.sort((left, right) =>
      left.regionId.localeCompare(right.regionId)
    ),
    passthroughIntervals: [...passthroughIntervals].sort(),
    unresolvedBailouts
  }
}

export const buildCenterDashedOverlapDiagnosticsFromResolvedPackets = (
  packets: SolidCenterStrokeResolvedPacket[],
  debugConfig: CenterDashedDebugConfig = getDebugConfig()
): CenterDashedOverlapDiagnostics => {
  const candidates =
    buildCenterDashedOverlapCandidatesFromResolvedPackets(packets)
  const graph = buildCenterDashedOverlapGraph(candidates)
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.candidateId, candidate])
  )
  const components = extractCenterDashedOverlapComponents(graph).map(
    (candidateIds, index) => {
      const componentCandidates = candidateIds
        .map((candidateId) => candidateById.get(candidateId))
        .filter(
          (candidate): candidate is CenterDashedOverlapCandidate => !!candidate
        )
      const polygons = componentCandidates.flatMap(({ polygons }) => polygons)

      return {
        componentId: `component:${index}`,
        candidateIds,
        bounds: getBounds(polygons),
        polygons
      }
    }
  )

  return {
    candidates,
    edges: graph.edges,
    components,
    ownership: buildOwnershipDiagnostics(components, candidateById, debugConfig)
  }
}

export const applyCenterDashedOverlapDiagnostics = <T extends object>(
  graphic: T,
  packets: SolidCenterStrokeResolvedPacket[],
  debugConfig?: CenterDashedDebugConfig
) => {
  const resolvedDebugConfig = debugConfig ?? getDebugConfig()
  if (!resolvedDebugConfig.enabled) {
    ;(
      graphic as T & CenterDashedOverlapDiagnosticsRuntimeGraphic
    ).__asyraCenterDashedOverlapDiagnostics = {
      candidates: [],
      edges: [],
      components: [],
      ownership: {
        ownedRegions: [],
        passthroughIntervals: [],
        unresolvedBailouts: []
      }
    }
    return
  }

  ;(
    graphic as T & CenterDashedOverlapDiagnosticsRuntimeGraphic
  ).__asyraCenterDashedOverlapDiagnostics =
    buildCenterDashedOverlapDiagnosticsFromResolvedPackets(
      packets,
      resolvedDebugConfig
    )
}
