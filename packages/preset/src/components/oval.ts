import { defineComponent } from '@asyra/core'
import { PropertyTypes, setElementGeometryLocalBounds } from '@asyra/utils'
import {
  applyRenderableFill,
  DEFAULT_OVAL_FILLS,
  getRenderableFills
} from './fills'
import { createEllipseHitArea } from './shape-hit-area'
import { DEFAULT_OVAL_STROKES } from './stroke-defaults'

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
    setElementGeometryLocalBounds(
      graphic as Parameters<typeof setElementGeometryLocalBounds>[0],
      {
        x: 0,
        y: 0,
        width: data.width,
        height: data.height
      }
    )
    ;(
      graphic as { hitArea: ReturnType<typeof createEllipseHitArea> | null }
    ).hitArea =
      getRenderableFills(data.fills).length > 0
        ? createEllipseHitArea(data.width, data.height)
        : null

    const replayPath = () => {
      graphic.ellipse(
        data.width / 2,
        data.height / 2,
        data.width / 2,
        data.height / 2
      )
    }
    replayPath()
    applyRenderableFill(graphic, data.fills, { replayPath })

    graphic.x = data.x
    graphic.y = data.y
    graphic.renderable = true
    graphic.visible = true
  }
})
