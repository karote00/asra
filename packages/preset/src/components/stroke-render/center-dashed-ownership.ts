export interface Vec2 {
  x: number
  y: number
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type PrimitiveKind = 'body' | 'join' | 'cap'

type BailoutReason =
  | 'overlay-instability'
  | 'numeric-instability'
  | 'owner-tie-unresolved'
  | 'illegal-domain-missing'

export interface CenterDashedOwnershipCandidate {
  candidateId: string
  intervalId: string
  strokeId: string
  ownerKey?: string
  networkId?: string
  primitiveKind: PrimitiveKind
  normalDistanceToSource: number
  startDistance: number
  authoredVisibleIntervalIndex: number
  stableIntervalId: string
  polygons: Vec2[][]
  continuityPreserving: boolean
  regionInsideTerminalEnvelope: boolean
}

interface CenterDashedOwnershipRegionInput {
  regionId: string
  polygon: Vec2[]
  candidates: CenterDashedOwnershipCandidate[]
}

interface ResolvedRegionOwnership {
  regionId: string
  ownerIntervalId: string
  ownerStrokeId: string
  ownerKey?: string
  networkId?: string
  ownerPrimitiveKind: PrimitiveKind
  polygon: Vec2[]
  bounds: Bounds
}

interface VisibilityBailoutRecord {
  componentId: string
  reason: BailoutReason
  preservedOwnerKeys: string[]
  preservedPreviewIntervalIds: string[]
  preservedPreviewPolygons: Vec2[][]
}

export interface CenterDashedOwnershipResult {
  ownedRegions: ResolvedRegionOwnership[]
  passthroughIntervals: string[]
  unresolvedBailouts: VisibilityBailoutRecord[]
}

interface ResolveCenterDashedOwnershipForComponentArgs {
  componentId: string
  regions: CenterDashedOwnershipRegionInput[]
  forceBailoutReason?: BailoutReason
  unaffectedPassthroughIntervals?: string[]
}

const getBounds = (polygon: Vec2[]): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygon.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })

  return { minX, minY, maxX, maxY }
}

const dedupeSorted = (values: string[]) => [...new Set(values)].sort()

const primitiveRank = (
  candidate: CenterDashedOwnershipCandidate,
  competingKinds: Set<PrimitiveKind>
) => {
  if (candidate.primitiveKind === 'body') {
    return 3
  }

  if (candidate.primitiveKind === 'join') {
    return 2
  }

  if (
    candidate.primitiveKind === 'cap' &&
    candidate.regionInsideTerminalEnvelope &&
    competingKinds.has('body')
  ) {
    return 4
  }

  return 1
}

const chooseDeterministicOwner = (
  candidates: CenterDashedOwnershipCandidate[]
) => {
  if (candidates.length === 0) {
    return null
  }

  const competingKinds = new Set(
    candidates.map(({ primitiveKind }) => primitiveKind)
  )
  const maxPrimitiveRank = Math.max(
    ...candidates.map((candidate) => primitiveRank(candidate, competingKinds))
  )

  let current = candidates.filter(
    (candidate) => primitiveRank(candidate, competingKinds) === maxPrimitiveRank
  )

  if (current.length === 1) {
    return current[0]
  }

  const continuityCandidates = current.filter(
    ({ continuityPreserving }) => continuityPreserving
  )
  if (continuityCandidates.length === 1) {
    return continuityCandidates[0]
  }
  if (continuityCandidates.length > 1) {
    current = continuityCandidates
  }

  const minNormalDistance = Math.min(
    ...current.map(({ normalDistanceToSource }) => normalDistanceToSource)
  )
  current = current.filter(
    ({ normalDistanceToSource }) => normalDistanceToSource === minNormalDistance
  )
  if (current.length === 1) {
    return current[0]
  }

  const minStartDistance = Math.min(
    ...current.map(({ startDistance }) => startDistance)
  )
  current = current.filter(
    ({ startDistance }) => startDistance === minStartDistance
  )
  if (current.length === 1) {
    return current[0]
  }

  const minVisibleIntervalIndex = Math.min(
    ...current.map(
      ({ authoredVisibleIntervalIndex }) => authoredVisibleIntervalIndex
    )
  )
  current = current.filter(
    ({ authoredVisibleIntervalIndex }) =>
      authoredVisibleIntervalIndex === minVisibleIntervalIndex
  )
  if (current.length === 1) {
    return current[0]
  }

  current.sort((left, right) =>
    left.stableIntervalId.localeCompare(right.stableIntervalId)
  )

  if (
    current.length > 1 &&
    current[0].stableIntervalId === current[1].stableIntervalId
  ) {
    return null
  }

  return current[0]
}

const buildBailoutRecord = (
  componentId: string,
  reason: BailoutReason,
  regions: CenterDashedOwnershipRegionInput[]
): VisibilityBailoutRecord => ({
  componentId,
  reason,
  preservedOwnerKeys: dedupeSorted(
    regions.flatMap(({ candidates }) =>
      candidates.flatMap(({ ownerKey }) => (ownerKey ? [ownerKey] : []))
    )
  ),
  preservedPreviewIntervalIds: dedupeSorted(
    regions.flatMap(({ candidates }) =>
      candidates.map(({ intervalId }) => intervalId)
    )
  ),
  preservedPreviewPolygons: regions.flatMap(({ candidates }) =>
    candidates.flatMap(({ polygons }) => polygons)
  )
})

export const resolveCenterDashedOwnershipForComponent = ({
  componentId,
  regions,
  forceBailoutReason,
  unaffectedPassthroughIntervals = []
}: ResolveCenterDashedOwnershipForComponentArgs): CenterDashedOwnershipResult => {
  if (forceBailoutReason) {
    return {
      ownedRegions: [],
      passthroughIntervals: [...unaffectedPassthroughIntervals].sort(),
      unresolvedBailouts: [
        buildBailoutRecord(componentId, forceBailoutReason, regions)
      ]
    }
  }

  const ownedRegions: ResolvedRegionOwnership[] = []

  for (const region of regions) {
    const owner = chooseDeterministicOwner(region.candidates)
    if (!owner) {
      return {
        ownedRegions: [],
        passthroughIntervals: [...unaffectedPassthroughIntervals].sort(),
        unresolvedBailouts: [
          buildBailoutRecord(componentId, 'owner-tie-unresolved', regions)
        ]
      }
    }

    ownedRegions.push({
      regionId: region.regionId,
      ownerIntervalId: owner.intervalId,
      ownerStrokeId: owner.strokeId,
      ownerKey: owner.ownerKey,
      networkId: owner.networkId,
      ownerPrimitiveKind: owner.primitiveKind,
      polygon: region.polygon,
      bounds: getBounds(region.polygon)
    })
  }

  return {
    ownedRegions: ownedRegions.sort((left, right) =>
      left.regionId.localeCompare(right.regionId)
    ),
    passthroughIntervals: [...unaffectedPassthroughIntervals].sort(),
    unresolvedBailouts: []
  }
}
