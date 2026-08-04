import type { ComponentDefinition, RenderStrategy } from '@asyra/core'
import { PropertyTypes, setElementGeometryLocalBounds } from '@asyra/utils'
import {
  applyRenderableFill,
  DEFAULT_RECTANGLE_FILLS,
  getRenderableFills
} from './fills.js'
import { createRectangleHitArea } from './shape-hit-area.js'
import { DEFAULT_RECTANGLE_STROKES } from './stroke-defaults.js'
import { PRESET_REGISTRATION } from '../registration.js'

export const RECTANGLE_COMPONENT_DEFINITION: ComponentDefinition = {
  type: 'rect',
  idPrefix: 'rect',
  namePrefix: 'Rectangle',
  registration: PRESET_REGISTRATION,
  properties: [
    {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION,
      alias: ['x', 'y', 'rotation']
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
  ]
}

export const RECTANGLE_RENDER_STRATEGY: RenderStrategy = (graphic, data) => {
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
    graphic as { hitArea: ReturnType<typeof createRectangleHitArea> | null }
  ).hitArea =
    getRenderableFills(data.fills).length > 0
      ? createRectangleHitArea(data.width, data.height)
      : null

  const replayPath = () => {
    graphic.rect(0, 0, data.width, data.height)
  }
  replayPath()
  applyRenderableFill(graphic, data.fills, { replayPath })

  graphic.x = data.x
  graphic.y = data.y
}
