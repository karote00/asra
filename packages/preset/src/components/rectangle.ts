import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_RECTANGLE_FILLS } from './fills'
import { DEFAULT_RECTANGLE_STROKES, renderPolylineStrokes } from './strokes'

defineComponent({
  type: 'rect',
  idPrefix: 'rect',
  namePrefix: 'Rectangle',
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
      defaultValue: DEFAULT_RECTANGLE_FILLS
    },
    {
      name: 'strokes',
      type: PropertyTypes.STROKES,
      defaultValue: DEFAULT_RECTANGLE_STROKES
    }
  ],
  renderStrategy: (graphic, data) => {
    graphic.clear()
    const replayPath = () => {
      graphic.rect(0, 0, data.width, data.height)
    }
    replayPath()
    applyRenderableFill(graphic, data.fills, { replayPath })
    renderPolylineStrokes(
      graphic,
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: data.width, y: 0 },
            { x: data.width, y: data.height },
            { x: 0, y: data.height }
          ],
          closed: true
        }
      ],
      data.strokes
    )
    graphic.x = data.x
    graphic.y = data.y
  }
})
