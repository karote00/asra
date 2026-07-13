export interface GeometryBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface GeometryTransformMatrix {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}

export interface GeometryBoundsCarrier {
  __asyraGeometryLocalBounds?: GeometryBounds | null
}

interface GeometryBoundsReadable extends GeometryBoundsCarrier {
  getBounds?: () => GeometryBounds
  getLocalBounds?: () => GeometryBounds
  toGlobal?: (
    position: { x: number; y: number },
    point?: { x: number; y: number },
    skipUpdate?: boolean
  ) => { x: number; y: number }
  worldTransform?: GeometryTransformMatrix
}

const cloneBounds = (bounds: GeometryBounds): GeometryBounds => ({
  x: bounds.x,
  y: bounds.y,
  width: bounds.width,
  height: bounds.height
})

const transformPoint = (
  matrix: GeometryTransformMatrix,
  point: { x: number; y: number }
) => ({
  x: matrix.a * point.x + matrix.c * point.y + matrix.tx,
  y: matrix.b * point.x + matrix.d * point.y + matrix.ty
})

export const setElementGeometryLocalBounds = (
  target: GeometryBoundsCarrier,
  bounds: GeometryBounds | null
) => {
  target.__asyraGeometryLocalBounds = bounds ? cloneBounds(bounds) : null
}

export const getElementGeometryLocalBounds = (
  element: GeometryBoundsReadable
): GeometryBounds => {
  const geometryBounds = element.__asyraGeometryLocalBounds
  if (geometryBounds) {
    return cloneBounds(geometryBounds)
  }

  if (typeof element.getLocalBounds === 'function') {
    return cloneBounds(element.getLocalBounds())
  }

  if (typeof element.getBounds === 'function') {
    return cloneBounds(element.getBounds())
  }

  return { x: 0, y: 0, width: 0, height: 0 }
}

export const getElementGeometryWorldBounds = (
  element: GeometryBoundsReadable
): GeometryBounds => {
  const geometryBounds = element.__asyraGeometryLocalBounds
  if (geometryBounds) {
    const localCorners = [
      { x: geometryBounds.x, y: geometryBounds.y },
      { x: geometryBounds.x + geometryBounds.width, y: geometryBounds.y },
      {
        x: geometryBounds.x + geometryBounds.width,
        y: geometryBounds.y + geometryBounds.height
      },
      { x: geometryBounds.x, y: geometryBounds.y + geometryBounds.height }
    ]
    const toGlobal = element.toGlobal
    const worldTransform = element.worldTransform
    const projectPoint =
      typeof toGlobal === 'function'
        ? (point: { x: number; y: number }) =>
            toGlobal.call(element, point, undefined, false)
        : worldTransform
          ? (point: { x: number; y: number }) =>
              transformPoint(worldTransform, point)
          : null

    if (projectPoint) {
      const topLeft = projectPoint(localCorners[0])
      const topRight = projectPoint(localCorners[1])
      const bottomRight = projectPoint(localCorners[2])
      const bottomLeft = projectPoint(localCorners[3])

      const minX = Math.min(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x)
      const maxX = Math.max(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x)
      const minY = Math.min(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y)
      const maxY = Math.max(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y)

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }
    }
  }

  if (typeof element.getBounds === 'function') {
    return cloneBounds(element.getBounds())
  }

  return getElementGeometryLocalBounds(element)
}
