import { defineComponent } from '@asyra/core'
import { EntityTypes, PropertyTypes } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_FRAME_FILLS } from './fills'
import {
  DEFAULT_FRAME_STROKES,
  buildPolylineStrokePathSources,
  renderStrokeSources
} from './strokes'

const buildFrameStrokeSources = (width: number, height: number) =>
  buildPolylineStrokePathSources([
    {
      points: [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height }
      ],
      closed: true
    }
  ])

defineComponent({
  type: EntityTypes.FRAME,
  idPrefix: 'fr',
  namePrefix: 'Frame',
  isContainer: true,
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
      defaultValue: DEFAULT_FRAME_FILLS
    },
    {
      name: 'strokes',
      type: PropertyTypes.STROKES,
      defaultValue: DEFAULT_FRAME_STROKES
    }
  ],
  renderStrategy: (graphic, data) => {
    graphic.clear()
    const replayPath = () => {
      graphic.rect(0, 0, data.width, data.height)
    }
    replayPath()
    applyRenderableFill(graphic, data.fills, { replayPath })
    renderStrokeSources(
      graphic,
      buildFrameStrokeSources(data.width, data.height),
      data.strokes
    )
    graphic.x = data.x
    graphic.y = data.y
  }
})
