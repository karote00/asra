import type {
  ArrangementFace,
  FillRule,
  PolygonRegion,
  Vec2
} from './geometry-backend'

const EPSILON = 1e-6

export interface ArrangementLegalDomain {
  legalDomainId?: string
  fillRule: FillRule
  regions: PolygonRegion[]
}

const isPointOnSegment = (point: Vec2, start: Vec2, end: Vec2) => {
  const cross =
    (end.x - start.x) * (point.y - start.y) -
    (end.y - start.y) * (point.x - start.x)

  if (Math.abs(cross) > EPSILON) {
    return false
  }

  return (
    point.x >= Math.min(start.x, end.x) - EPSILON &&
    point.x <= Math.max(start.x, end.x) + EPSILON &&
    point.y >= Math.min(start.y, end.y) - EPSILON &&
    point.y <= Math.max(start.y, end.y) + EPSILON
  )
}

const isPointOnPolygonBoundary = (point: Vec2, polygon: Vec2[]) =>
  polygon.some((start, index) =>
    isPointOnSegment(
      point,
      start,
      polygon[(index + 1) % polygon.length] ?? start
    )
  )

const windingContribution = (point: Vec2, polygon: Vec2[]) => {
  let winding = 0

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length] ?? current
    if (!current || !next) {
      continue
    }
    const crossesUp = current.y <= point.y && next.y > point.y
    const crossesDown = current.y > point.y && next.y <= point.y
    const cross =
      (next.x - current.x) * (point.y - current.y) -
      (next.y - current.y) * (point.x - current.x)

    if (crossesUp && cross > EPSILON) {
      winding += 1
    } else if (crossesDown && cross < -EPSILON) {
      winding -= 1
    }
  }

  return winding
}

const isPointInsideEvenOdd = (point: Vec2, polygons: Vec2[][]) => {
  let inside = false

  polygons.forEach((polygon) => {
    for (
      let index = 0, previousIndex = polygon.length - 1;
      index < polygon.length;
      previousIndex = index, index += 1
    ) {
      const current = polygon[index]
      const previous = polygon[previousIndex]
      if (!current || !previous) {
        continue
      }
      const intersects =
        current.y > point.y !== previous.y > point.y &&
        point.x <
          ((previous.x - current.x) * (point.y - current.y)) /
            (previous.y - current.y) +
            current.x

      if (intersects) {
        inside = !inside
      }
    }
  })

  return inside
}

const isPointStrictlyInsidePolygon = (point: Vec2, polygon: Vec2[]) =>
  !isPointOnPolygonBoundary(point, polygon) &&
  isPointInsideEvenOdd(point, [polygon])

const isPointInsideNonZero = (point: Vec2, polygons: Vec2[][]) =>
  polygons.reduce(
    (winding, polygon) => winding + windingContribution(point, polygon),
    0
  ) !== 0

const isPointInsideLegalDomain = (
  point: Vec2,
  domain: ArrangementLegalDomain
) => {
  const polygons = domain.regions.flatMap((region) => region.polygons)
  if (polygons.some((polygon) => isPointOnPolygonBoundary(point, polygon))) {
    return true
  }

  return domain.fillRule === 'nonzero'
    ? isPointInsideNonZero(point, polygons)
    : isPointInsideEvenOdd(point, polygons)
}

const isPointInsideRegion = (point: Vec2, region: PolygonRegion) =>
  region.polygons.some((polygon) => isPointOnPolygonBoundary(point, polygon)) ||
  isPointInsideEvenOdd(point, region.polygons)

const getPolygonVertexAverage = (polygon: Vec2[]) => {
  if (polygon.length === 0) {
    return null
  }

  const sum = polygon.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  )

  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length
  }
}

const getPolygonAreaCentroid = (polygon: Vec2[]) => {
  let signedArea = 0
  let centroidX = 0
  let centroidY = 0

  polygon.forEach((current, index) => {
    const next = polygon[(index + 1) % polygon.length] ?? current
    const cross = current.x * next.y - next.x * current.y
    signedArea += cross
    centroidX += (current.x + next.x) * cross
    centroidY += (current.y + next.y) * cross
  })

  if (Math.abs(signedArea) <= EPSILON) {
    return null
  }

  return {
    x: centroidX / (3 * signedArea),
    y: centroidY / (3 * signedArea)
  }
}

const getPolygonBounds = (polygon: Vec2[]) =>
  polygon.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    }
  )

const getGridInteriorSample = (polygon: Vec2[]) => {
  const bounds = getPolygonBounds(polygon)
  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.minY) ||
    bounds.maxX - bounds.minX <= EPSILON ||
    bounds.maxY - bounds.minY <= EPSILON
  ) {
    return null
  }

  for (let yStep = 1; yStep < 8; yStep += 1) {
    for (let xStep = 1; xStep < 8; xStep += 1) {
      const point = {
        x: bounds.minX + ((bounds.maxX - bounds.minX) * xStep) / 8,
        y: bounds.minY + ((bounds.maxY - bounds.minY) * yStep) / 8
      }
      if (isPointStrictlyInsidePolygon(point, polygon)) {
        return point
      }
    }
  }

  return null
}

const getGridInteriorSampleInRegion = (
  polygon: Vec2[],
  region: PolygonRegion
) => {
  const bounds = getPolygonBounds(polygon)
  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.minY) ||
    bounds.maxX - bounds.minX <= EPSILON ||
    bounds.maxY - bounds.minY <= EPSILON
  ) {
    return null
  }

  for (let yStep = 1; yStep < 16; yStep += 1) {
    for (let xStep = 1; xStep < 16; xStep += 1) {
      const point = {
        x: bounds.minX + ((bounds.maxX - bounds.minX) * xStep) / 16,
        y: bounds.minY + ((bounds.maxY - bounds.minY) * yStep) / 16
      }
      if (
        isPointStrictlyInsidePolygon(point, polygon) &&
        isPointInsideRegion(point, region)
      ) {
        return point
      }
    }
  }

  return null
}

const getPolygonInteriorSamplePoint = (polygon: Vec2[]) => {
  const candidatePoints = [
    getPolygonAreaCentroid(polygon),
    getPolygonVertexAverage(polygon),
    ...polygon.map((point, index) => {
      const next = polygon[(index + 1) % polygon.length] ?? point
      return {
        x: (point.x + next.x) / 2,
        y: (point.y + next.y) / 2
      }
    })
  ].filter((point): point is Vec2 => !!point)

  const directInterior = candidatePoints.find((point) =>
    isPointStrictlyInsidePolygon(point, polygon)
  )
  if (directInterior) {
    return directInterior
  }

  return getGridInteriorSample(polygon)
}

const getPolygonInteriorSamplePointInRegion = (
  polygon: Vec2[],
  region: PolygonRegion
) => {
  const candidatePoints = [
    getPolygonAreaCentroid(polygon),
    getPolygonVertexAverage(polygon),
    ...polygon.map((point, index) => {
      const next = polygon[(index + 1) % polygon.length] ?? point
      return {
        x: (point.x + next.x) / 2,
        y: (point.y + next.y) / 2
      }
    })
  ].filter((point): point is Vec2 => !!point)

  const directInterior = candidatePoints.find(
    (point) =>
      isPointStrictlyInsidePolygon(point, polygon) &&
      isPointInsideRegion(point, region)
  )
  if (directInterior) {
    return directInterior
  }

  return getGridInteriorSampleInRegion(polygon, region)
}

const classifySamplePointLegalState = (
  samplePoint: Vec2,
  domains: ArrangementLegalDomain[]
) => {
  const insideFillDomain = domains.some((domain) =>
    isPointInsideLegalDomain(samplePoint, domain)
  )

  return {
    insideFillDomain,
    outsideFillDomain: !insideFillDomain
  }
}

const legalStateSignature = (legalState: ArrangementFace['legalState']) =>
  `${legalState.insideFillDomain ? 'inside' : 'not-inside'}:${
    legalState.outsideFillDomain ? 'outside' : 'not-outside'
  }`

const classifyArrangementFaceByLegalDomain = (
  face: ArrangementFace,
  domains: ArrangementLegalDomain[]
): ArrangementFace[] => {
  if (domains.length === 0) {
    return [face]
  }

  const sampledComponents = face.geometry.polygons.flatMap((polygon, index) => {
    if (polygon.length < 3) {
      return []
    }

    const samplePoint = getPolygonInteriorSamplePointInRegion(
      polygon,
      face.geometry
    )
    if (!samplePoint) {
      return []
    }

    return [
      {
        polygon,
        index,
        legalState: classifySamplePointLegalState(samplePoint, domains)
      }
    ]
  })

  if (sampledComponents.length === 0) {
    const samplePoint = face.geometry.polygons.flatMap(
      (polygon) => getPolygonInteriorSamplePoint(polygon) ?? []
    )[0]
    return [
      {
        ...face,
        legalState: samplePoint
          ? classifySamplePointLegalState(samplePoint, domains)
          : face.legalState
      }
    ]
  }

  const groups = new Map<
    string,
    {
      legalState: ArrangementFace['legalState']
      polygons: Vec2[][]
      sourceIndices: number[]
    }
  >()

  sampledComponents.forEach((component) => {
    const signature = legalStateSignature(component.legalState)
    const existing = groups.get(signature) ?? {
      legalState: component.legalState,
      polygons: [],
      sourceIndices: []
    }
    existing.polygons.push(component.polygon)
    existing.sourceIndices.push(component.index)
    groups.set(signature, existing)
  })

  if (groups.size === 1) {
    return [
      {
        ...face,
        legalState: sampledComponents[0]?.legalState ?? face.legalState
      }
    ]
  }

  return [...groups.values()].map((group, index) => ({
    ...face,
    faceId: `${face.faceId}:legal-split:${index}`,
    geometry: {
      polygons: group.polygons
    },
    legalState: group.legalState
  }))
}

export const classifyArrangementFacesByLegalDomain = (
  faces: ArrangementFace[],
  domains: ArrangementLegalDomain[]
): ArrangementFace[] =>
  domains.length === 0
    ? faces
    : faces.flatMap((face) =>
        classifyArrangementFaceByLegalDomain(face, domains)
      )
