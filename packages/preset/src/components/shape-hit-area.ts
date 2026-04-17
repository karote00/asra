interface HitAreaLike {
  contains: (x: number, y: number) => boolean
}

export const createRectangleHitArea = (
  width: number,
  height: number
): HitAreaLike => ({
  contains: (x: number, y: number) => x >= 0 && x <= width && y >= 0 && y <= height
})

export const createEllipseHitArea = (
  width: number,
  height: number
): HitAreaLike => {
  const radiusX = width / 2
  const radiusY = height / 2
  const centerX = radiusX
  const centerY = radiusY

  if (radiusX <= 0 || radiusY <= 0) {
    return {
      contains: () => false
    }
  }

  return {
    contains: (x: number, y: number) => {
      const normalizedX = (x - centerX) / radiusX
      const normalizedY = (y - centerY) / radiusY
      return normalizedX * normalizedX + normalizedY * normalizedY <= 1
    }
  }
}

export const mergeHitAreas = (
  primary: HitAreaLike | null,
  secondary: HitAreaLike | null
): HitAreaLike | null => {
  if (primary && secondary) {
    return {
      contains: (x: number, y: number) =>
        primary.contains(x, y) || secondary.contains(x, y)
    }
  }

  return primary ?? secondary
}
