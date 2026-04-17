interface Vec2 {
  x: number
  y: number
}

const MIN_ELLIPSE_SEGMENTS = 64
const MAX_ELLIPSE_SEGMENTS = 256
const TARGET_SEGMENT_LENGTH = 6

const approximateEllipsePerimeter = (radiusX: number, radiusY: number) => {
  const sum = radiusX + radiusY
  if (sum <= 0) {
    return 0
  }

  const h = ((radiusX - radiusY) ** 2) / (sum ** 2)
  return (
    Math.PI *
    sum *
    (1 + (3 * h) / (10 + Math.sqrt(Math.max(1, 4 - 3 * h))))
  )
}

const clampEllipseSegments = (segmentCount: number) =>
  Math.max(
    MIN_ELLIPSE_SEGMENTS,
    Math.min(MAX_ELLIPSE_SEGMENTS, segmentCount)
  )

const normalizeEllipseSegments = (segmentCount: number) => {
  const clamped = clampEllipseSegments(segmentCount)
  const remainder = clamped % 4
  return remainder === 0 ? clamped : clamped + (4 - remainder)
}

export const buildEllipseLoop = (width: number, height: number): Vec2[] => {
  if (!(width > 0) || !(height > 0)) {
    return []
  }

  const centerX = width / 2
  const centerY = height / 2
  const radiusX = width / 2
  const radiusY = height / 2
  const perimeter = approximateEllipsePerimeter(radiusX, radiusY)
  const segmentCount = normalizeEllipseSegments(
    Math.ceil(perimeter / TARGET_SEGMENT_LENGTH)
  )

  return Array.from({ length: segmentCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / segmentCount
    return {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY
    }
  })
}
