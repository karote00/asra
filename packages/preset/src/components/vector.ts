import { PropertyTypes } from '@asyra/utils'
import type { RenderStrategy } from '@asyra/core'
import { defineComponent } from '@asyra/core'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'

interface VectorComputedData {
  x: number
  y: number
  width: number
  height: number
  points: Record<string, VectorPointNode>
  segments: Record<string, VectorSegment>
  networks: Record<string, VectorNetwork>
  closed: boolean
  fill: string
  stroke: string
  strokeWidth: number
}

const parseHexColor = (color: string, fallback: number) => {
  const parsed = Number.parseInt(color.replace('#', ''), 16)
  return Number.isNaN(parsed) ? fallback : parsed
}

const getNumericSuffix = (value: string) => {
  const match = value.match(/[-_](\d+)$/)
  if (!match) {
    return Number.NaN
  }

  return Number.parseInt(match[1], 10)
}

const sortByStableId = <T extends { id: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aRank = getNumericSuffix(a.id)
    const bRank = getNumericSuffix(b.id)
    if (!Number.isNaN(aRank) && !Number.isNaN(bRank)) {
      return aRank - bRank
    }

    return a.id.localeCompare(b.id)
  })

const vectorRenderStrategy: RenderStrategy = (graphic, data) => {
  graphic.clear()

  const typedData = data as typeof data & VectorComputedData
  const {
    closed,
    fill,
    stroke,
    strokeWidth,
    x,
    y,
    points,
    segments,
    networks
  } = typedData

  const orderedNetworks = sortByStableId(Object.values(networks))
  if (orderedNetworks.length === 0) {
    return
  }

  graphic.x = x
  graphic.y = y

  const strokeColor = parseHexColor(stroke, 0xcccccc)

  orderedNetworks.forEach((network) => {
    const firstId = network.pointIds[0]
    const first = firstId ? points[firstId] : undefined
    if (!first || first.kind !== 'anchor') {
      return
    }

    graphic.moveTo(first.x, first.y)

    network.segmentIds.forEach((segmentId) => {
      const segment = segments[segmentId]
      if (!segment) {
        return
      }

      const start = points[segment.startId]
      const end = points[segment.endId]
      if (!start || !end || start.kind !== 'anchor' || end.kind !== 'anchor') {
        return
      }

      const outControl =
        segment.outControlId && points[segment.outControlId]?.kind === 'control'
          ? points[segment.outControlId]
          : null
      const inControl =
        segment.inControlId && points[segment.inControlId]?.kind === 'control'
          ? points[segment.inControlId]
          : null

      if (!outControl && !inControl) {
        graphic.lineTo(end.x, end.y)
        return
      }

      graphic.bezierCurveTo(
        outControl?.x ?? start.x,
        outControl?.y ?? start.y,
        inControl?.x ?? end.x,
        inControl?.y ?? end.y,
        end.x,
        end.y
      )
    })

    if (network.closed) {
      graphic.closePath()
    }
  })

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
      name: 'points',
      type: PropertyTypes.VECTOR_POINTS,
      defaultValue: {} as Record<string, VectorPointNode>
    },
    {
      name: 'segments',
      type: PropertyTypes.VECTOR_SEGMENTS,
      defaultValue: {} as Record<string, VectorSegment>
    },
    {
      name: 'networks',
      type: PropertyTypes.VECTOR_NETWORKS,
      defaultValue: {} as Record<string, VectorNetwork>
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
