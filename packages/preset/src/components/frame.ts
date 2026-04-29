import { defineComponent } from '@asyra/core'
import {
  EntityTypes,
  PropertyTypes,
  setElementGeometryLocalBounds
} from '@asyra/utils'
import { applyRenderableFill, DEFAULT_FRAME_FILLS } from './fills'

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
    }
  ],
  renderStrategy: (graphic, data) => {
    graphic.clear()
    setElementGeometryLocalBounds(
      graphic as Parameters<typeof setElementGeometryLocalBounds>[0],
      {
        x: 0,
        y: 0,
        width: data.width,
        height: data.height
      }
    )
    const replayPath = () => {
      graphic.rect(0, 0, data.width, data.height)
    }
    replayPath()
    applyRenderableFill(graphic, data.fills, { replayPath })
    graphic.x = data.x
    graphic.y = data.y
  }
})
