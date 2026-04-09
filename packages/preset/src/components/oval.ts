import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_OVAL_FILLS } from './fills'
import {
  DEFAULT_OVAL_STROKES,
  buildPolylineStrokePathSources,
  renderStrokeSources
} from './strokes'

const OVAL_STROKE_SEGMENTS = 48

const buildOvalStrokeSources = (width: number, height: number) =>
  buildPolylineStrokePathSources([
    {
      points: Array.from({ length: OVAL_STROKE_SEGMENTS }, (_, index) => {
        const angle = (index / OVAL_STROKE_SEGMENTS) * Math.PI * 2
        return {
          x: width / 2 + Math.cos(angle) * (width / 2),
          y: height / 2 + Math.sin(angle) * (height / 2)
        }
      }),
      closed: true
    }
  ])

defineComponent({
  type: 'oval',
  idPrefix: 'oval',
  namePrefix: 'Oval',
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
      name: 'fills',
      type: PropertyTypes.FILLS,
      defaultValue: DEFAULT_OVAL_FILLS
    },
    {
      name: 'strokes',
      type: PropertyTypes.STROKES,
      defaultValue: DEFAULT_OVAL_STROKES
    }
  ],
  renderStrategy: (graphic, data) => {
    graphic.clear()

    const replayPath = () => {
      // Draw ellipse
      graphic.ellipse(
        data.width / 2,
        data.height / 2,
        data.width / 2,
        data.height / 2
      )
    }
    replayPath()
    applyRenderableFill(graphic, data.fills, { replayPath })
    renderStrokeSources(
      graphic,
      buildOvalStrokeSources(data.width, data.height),
      data.strokes
    )

    graphic.x = data.x
    graphic.y = data.y

    // Ensure graphic is rendered (force update in E2E)
    graphic.renderable = true
    graphic.visible = true
  }
})
