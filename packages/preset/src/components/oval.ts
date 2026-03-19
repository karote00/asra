import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_OVAL_FILLS } from './fills'
import { DEFAULT_OVAL_STROKES, renderPolylineStrokes } from './strokes'

const OVAL_STROKE_SEGMENTS = 48

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
    renderPolylineStrokes(
      graphic,
      [
        {
          points: Array.from({ length: OVAL_STROKE_SEGMENTS }, (_, index) => {
            const angle = (index / OVAL_STROKE_SEGMENTS) * Math.PI * 2
            return {
              x: data.width / 2 + Math.cos(angle) * (data.width / 2),
              y: data.height / 2 + Math.sin(angle) * (data.height / 2)
            }
          }),
          closed: true
        }
      ],
      data.strokes
    )

    graphic.x = data.x
    graphic.y = data.y

    // Ensure graphic is rendered (force update in E2E)
    graphic.renderable = true
    graphic.visible = true
  }
})
