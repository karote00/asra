import { VECTOR_TOKENS, type VectorTopology } from '@asyra/core'

export const buildVectorIconPath = (
  topology: VectorTopology | null | undefined
): string | null => {
  if (!topology || Object.keys(topology.networks).length === 0) {
    return null
  }

  const { points, segments, networks } = topology
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const pointValues = Object.values(points)
  if (pointValues.length === 0) {
    return null
  }

  pointValues.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })

  // Center and scale to fit inside 18x18 SVG constraints.
  const width = maxX - minX
  const height = maxY - minY
  const size = Math.max(width, height, 1)
  const scale = 14 / size
  const cx = minX + width / 2
  const cy = minY + height / 2

  const dPaths: string[] = []

  Object.values(networks).forEach((network) => {
    const firstId = network.pointIds[0]
    const first = firstId ? points[firstId] : undefined
    if (!first || first.kind !== VECTOR_TOKENS.POINT.KIND.ANCHOR) return

    let path = `M ${(first.x - cx) * scale + 12} ${(first.y - cy) * scale + 12}`

    network.segmentIds.forEach((segmentId) => {
      const segment = segments[segmentId]
      if (!segment) return

      const start = points[segment.startId]
      const end = points[segment.endId]
      if (
        !start ||
        !end ||
        start.kind !== VECTOR_TOKENS.POINT.KIND.ANCHOR ||
        end.kind !== VECTOR_TOKENS.POINT.KIND.ANCHOR
      ) {
        return
      }

      const outControl =
        segment.outControlId &&
        points[segment.outControlId]?.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
          ? points[segment.outControlId]
          : null
      const inControl =
        segment.inControlId &&
        points[segment.inControlId]?.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
          ? points[segment.inControlId]
          : null

      if (!outControl && !inControl) {
        path += ` L ${(end.x - cx) * scale + 12} ${(end.y - cy) * scale + 12}`
      } else {
        const cp1x = outControl ? outControl.x : start.x
        const cp1y = outControl ? outControl.y : start.y
        const cp2x = inControl ? inControl.x : end.x
        const cp2y = inControl ? inControl.y : end.y
        path += ` C ${(cp1x - cx) * scale + 12} ${(cp1y - cy) * scale + 12}, ${(cp2x - cx) * scale + 12} ${(cp2y - cy) * scale + 12}, ${(end.x - cx) * scale + 12} ${(end.y - cy) * scale + 12}`
      }
    })

    if (network.closed) {
      path += ' Z'
    }
    dPaths.push(path)
  })

  return dPaths.join(' ')
}
