import { defineComponent } from '../define-component'
import { PropertyTypes } from '@asyra/utils'
import type { RenderStrategy } from '@asyra/render'
import { Graphics } from 'pixi.js'

interface AnchorPoint {
  id: string
  x: number
  y: number
  type: 'smooth' | 'sharp'
  inHandle: { x: number; y: number } | null
  outHandle: { x: number; y: number } | null
}

interface VectorPathData {
  anchorPoints: AnchorPoint[]
  closed: boolean
  fill: string
  stroke: string
  strokeWidth: number
}

const VECTOR_POINT_LABEL = '__vector-point__'
const VECTOR_POINT_RADIUS = 6 // 12px diameter
const VECTOR_POINT_COLOR = 0x9ca3af

const getLocalPoint = (
  point: AnchorPoint,
  data: { x: number; y: number; width: number; height: number }
) => {
  // Supports both local-point data and legacy absolute-point data.
  const isLikelyLocal =
    point.x >= -1 &&
    point.x <= data.width + 1 &&
    point.y >= -1 &&
    point.y <= data.height + 1

  if (isLikelyLocal) {
    return point
  }

  return {
    ...point,
    x: point.x - data.x,
    y: point.y - data.y
  }
}

const syncVectorPointHandles = (
  graphic: Graphics,
  points: AnchorPoint[],
  strokeColor: number
) => {
  if (
    !('children' in graphic) ||
    !('addChild' in graphic) ||
    !('removeChild' in graphic)
  ) {
    return
  }

  const children = [...graphic.children]
  children.forEach((child) => {
    if (child.label === VECTOR_POINT_LABEL) {
      graphic.removeChild(child)
      if ('destroy' in child && typeof child.destroy === 'function') {
        child.destroy()
      }
    }
  })

  points.forEach((point) => {
    const handle = new Graphics()
    handle.label = VECTOR_POINT_LABEL
    handle.eventMode = 'none'
    handle.x = point.x
    handle.y = point.y
    handle.circle(0, 0, VECTOR_POINT_RADIUS).fill(VECTOR_POINT_COLOR)
    if ('stroke' in handle && typeof handle.stroke === 'function') {
      handle.stroke({ width: 1, color: strokeColor })
    }
    graphic.addChild(handle)
  })
}

const vectorRenderStrategy: RenderStrategy = (graphic, data) => {
  graphic.clear()

  const typedData = data as typeof data & VectorPathData
  const { anchorPoints, closed, fill, stroke, strokeWidth, x, y } = typedData

  if (!anchorPoints || anchorPoints.length === 0) return

  graphic.x = x
  graphic.y = y

  const strokeColor = parseInt(stroke.replace('#', '0x'), 16)
  const localAnchorPoints = anchorPoints.map((point) =>
    getLocalPoint(point, typedData)
  )
  if (localAnchorPoints.length > 1) {
    graphic.setStrokeStyle({
      width: strokeWidth,
      color: strokeColor,
      cap: 'round',
      join: 'round'
    })

    const firstPoint = localAnchorPoints[0]
    graphic.moveTo(firstPoint.x, firstPoint.y)

    for (let i = 1; i < localAnchorPoints.length; i++) {
      const current = localAnchorPoints[i]
      const prev = localAnchorPoints[i - 1]

      if (current.type === 'smooth' && current.inHandle && prev.outHandle) {
        graphic.bezierCurveTo(
          prev.outHandle.x,
          prev.outHandle.y,
          current.inHandle.x,
          current.inHandle.y,
          current.x,
          current.y
        )
      } else {
        graphic.lineTo(current.x, current.y)
      }
    }

    if ('stroke' in graphic && typeof graphic.stroke === 'function') {
      graphic.stroke({
        width: strokeWidth,
        color: strokeColor,
        cap: 'round',
        join: 'round'
      })
    }

    if (closed) {
      graphic.closePath()

      if (fill !== 'none') {
        const fillColor = parseInt(fill.replace('#', '0x'), 16)
        graphic.fill(fillColor)
      }
    }
  }

  syncVectorPointHandles(graphic as Graphics, localAnchorPoints, strokeColor)
}

defineComponent({
  type: 'vector',
  idPrefix: 'vector',
  namePrefix: 'Vector',
  properties: [
    {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION,
      alias: ['x', 'y']
    },
    {
      name: PropertyTypes.DIMENSION,
      type: PropertyTypes.DIMENSION,
      alias: ['width', 'height']
    },
    {
      name: 'anchorPoints',
      type: PropertyTypes.CUSTOM,
      defaultValue: [] as AnchorPoint[]
    },
    {
      name: 'closed',
      type: PropertyTypes.CUSTOM,
      defaultValue: false
    },
    {
      name: 'fill',
      type: PropertyTypes.CUSTOM,
      defaultValue: 'none'
    },
    {
      name: 'stroke',
      type: PropertyTypes.CUSTOM,
      defaultValue: '#000000'
    },
    {
      name: 'strokeWidth',
      type: PropertyTypes.CUSTOM,
      defaultValue: 2
    }
  ],
  renderStrategy: vectorRenderStrategy
})
