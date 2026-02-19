import { defineComponent } from '../define-component'
import { PropertyTypes } from '@asyra/utils'
import type { RenderStrategy } from '@asyra/render'

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

const vectorRenderStrategy: RenderStrategy = (graphic, data) => {
  graphic.clear()

  const typedData = data as typeof data & VectorPathData
  const { anchorPoints, closed, fill, stroke, strokeWidth, x, y } = typedData

  if (!anchorPoints || anchorPoints.length < 2) return

  const strokeColor = parseInt(stroke.replace('#', '0x'), 16)

  graphic.setStrokeStyle({
    width: strokeWidth,
    color: strokeColor,
    cap: 'round',
    join: 'round'
  })

  const firstPoint = anchorPoints[0]
  graphic.moveTo(firstPoint.x - x, firstPoint.y - y)

  for (let i = 1; i < anchorPoints.length; i++) {
    const current = anchorPoints[i]
    const prev = anchorPoints[i - 1]

    if (current.type === 'smooth' && current.inHandle && prev.outHandle) {
      graphic.bezierCurveTo(
        prev.outHandle.x - x,
        prev.outHandle.y - y,
        current.inHandle.x - x,
        current.inHandle.y - y,
        current.x - x,
        current.y - y
      )
    } else {
      graphic.lineTo(current.x - x, current.y - y)
    }
  }

  if (closed) {
    graphic.closePath()

    if (fill !== 'none') {
      const fillColor = parseInt(fill.replace('#', '0x'), 16)
      graphic.fill(fillColor)
    }
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
