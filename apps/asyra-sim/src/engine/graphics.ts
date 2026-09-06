import * as THREE from 'three'
import type {
  RenderEngineDrawOperation,
  RenderEnginePaint
} from '@asyra/render-engine'

export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]
      materials.forEach((material) => material.dispose())
    }
  })
  object.clear()
  object.removeFromParent()
}

/** Screen-space graphics are a visual bridge, never an analysis geometry source. */
export function drawGraphics(
  operations: readonly RenderEngineDrawOperation[],
  resolvePaint: (paint: RenderEnginePaint) => {
    color: number | string
    alpha: number
  }
): THREE.Group {
  const group = new THREE.Group()
  let path = new THREE.ShapePath()
  try {
    for (const op of operations) {
      switch (op.type) {
        case 'clear':
          disposeObject(group)
          path = new THREE.ShapePath()
          break
        case 'rect':
          path.moveTo(op.x, op.y)
          path.lineTo(op.x + op.width, op.y)
          path.lineTo(op.x + op.width, op.y + op.height)
          path.lineTo(op.x, op.y + op.height)
          if (!path.currentPath)
            throw new Error('Rectangle path was not created')
          path.currentPath.closePath()
          break
        case 'circle':
        case 'ellipse': {
          const radiusX = op.type === 'circle' ? op.radius : op.radiusX
          const radiusY = op.type === 'circle' ? op.radius : op.radiusY
          path.moveTo(op.x + radiusX, op.y)
          if (!path.currentPath) throw new Error('Ellipse path was not created')
          path.currentPath.absellipse(
            op.x,
            op.y,
            radiusX,
            radiusY,
            0,
            Math.PI * 2,
            false,
            0
          )
          break
        }
        case 'move-to':
          path.moveTo(op.x, op.y)
          break
        case 'line-to':
          path.lineTo(op.x, op.y)
          break
        case 'bezier-curve-to':
          path.bezierCurveTo(
            op.controlPoint1.x,
            op.controlPoint1.y,
            op.controlPoint2.x,
            op.controlPoint2.y,
            op.destination.x,
            op.destination.y
          )
          break
        case 'close-path':
          path.currentPath?.closePath()
          break
        case 'poly':
          op.points.forEach((point, i) => {
            if (i === 0) path.moveTo(point.x, point.y)
            else path.lineTo(point.x, point.y)
          })
          if (op.close) path.currentPath?.closePath()
          break
        case 'fill': {
          const paint = resolvePaint(op.paint)
          const shapes = path.toShapes()
          if (shapes.length)
            group.add(
              new THREE.Mesh(
                new THREE.ShapeGeometry(shapes),
                new THREE.MeshBasicMaterial({
                  color: paint.color,
                  opacity: paint.alpha,
                  transparent: paint.alpha < 1,
                  side: THREE.DoubleSide,
                  depthTest: false
                })
              )
            )
          break
        }
        case 'stroke': {
          if (op.width !== 1)
            throw new Error(
              'The CUSTOM screen bridge supports only a one device pixel stroke'
            )
          const paint = resolvePaint(op.paint)
          for (const sub of path.subPaths) {
            const points = sub
              .getPoints(32)
              .map((p) => new THREE.Vector3(p.x, p.y, 0))
            if (points.length > 1)
              group.add(
                new THREE.Line(
                  new THREE.BufferGeometry().setFromPoints(points),
                  new THREE.LineBasicMaterial({
                    color: paint.color,
                    opacity: paint.alpha,
                    transparent: paint.alpha < 1,
                    linewidth: op.width,
                    depthTest: false
                  })
                )
              )
          }
          break
        }
      }
    }
    return group
  } catch (error) {
    disposeObject(group)
    throw error
  }
}
