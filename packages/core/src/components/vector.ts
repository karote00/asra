import { PropertyTypes } from '@asyra/utils'
import type { RenderStrategy } from '@asyra/render'
import { defineComponent } from '../define-component'
import type { VectorAnchorPoint } from '../types/vector'

interface VectorComputedData {
  x: number
  y: number
  width: number
  height: number
  anchorPoints: VectorAnchorPoint[]
  closed: boolean
  fill: string
  stroke: string
  strokeWidth: number
}

const getLocalPoint = (
  point: VectorAnchorPoint,
  data: Pick<VectorComputedData, 'x' | 'y' | 'width' | 'height'>
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

const parseHexColor = (color: string, fallback: number) => {
  const parsed = Number.parseInt(color.replace('#', ''), 16)
  return Number.isNaN(parsed) ? fallback : parsed
}

const vectorRenderStrategy: RenderStrategy = (graphic, data) => {
  graphic.clear()

  const typedData = data as typeof data & VectorComputedData
  const { anchorPoints, closed, fill, stroke, strokeWidth, x, y } = typedData
  if (!Array.isArray(anchorPoints) || anchorPoints.length === 0) {
    return
  }

  graphic.x = x
  graphic.y = y

  const strokeColor = parseHexColor(stroke, 0xcccccc)
  const localAnchorPoints = anchorPoints.map((point) =>
    getLocalPoint(point, typedData)
  )

  const firstPoint = localAnchorPoints[0]
  graphic.moveTo(firstPoint.x, firstPoint.y)

  let prevPoint = firstPoint
  for (let i = 1; i < localAnchorPoints.length; i++) {
    const current = localAnchorPoints[i]

    if (current.isMove) {
      graphic.moveTo(current.x, current.y)
      prevPoint = current
      continue
    }

    if (current.type === 'smooth' && current.inHandle && prevPoint.outHandle) {
      graphic.bezierCurveTo(
        prevPoint.outHandle.x,
        prevPoint.outHandle.y,
        current.inHandle.x,
        current.inHandle.y,
        current.x,
        current.y
      )
    } else {
      graphic.lineTo(current.x, current.y)
    }

    prevPoint = current
  }

  if (closed) {
    graphic.closePath()
  }

  if (closed && fill !== 'none') {
    graphic.fill(parseHexColor(fill, 0x000000))
  }

  if ('stroke' in graphic && typeof graphic.stroke === 'function') {
    graphic.stroke({
      width: strokeWidth,
      color: strokeColor,
      cap: 'round',
      join: 'round'
    })
  }
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
      defaultValue: [] as VectorAnchorPoint[]
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
      name: 'strokeStyle',
      type: PropertyTypes.CUSTOM,
      alias: ['stroke', 'strokeWidth'],
      defaultValue: {
        stroke: '#cccccc',
        strokeWidth: 1
      }
    }
  ],
  renderStrategy: vectorRenderStrategy
})
