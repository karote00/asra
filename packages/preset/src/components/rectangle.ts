import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_RECTANGLE_FILLS, getRenderableFills } from './fills'
import { createRectangleHitArea, mergeHitAreas } from './shape-hit-area'
import { DEFAULT_RECTANGLE_STROKES } from './stroke-render/constants'
import { renderSolidCenterStrokeEntries } from './stroke-render/solid-center-stroke-render'
import {
  applySolidCenterStrokeExportPackets,
  buildSolidCenterStrokeResolvedPackets,
  createSolidCenterStrokeHitArea,
  toSolidCenterStrokeRenderEntries
} from './stroke-render/solid-center-stroke-packets'

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
    const solidCenterPackets = buildSolidCenterStrokeResolvedPackets(
      `rect:${data.id ?? 'anonymous'}`,
      [
        { x: 0, y: 0 },
        { x: data.width, y: 0 },
        { x: data.width, y: data.height },
        { x: 0, y: data.height }
      ],
      true,
      data.strokes
    )
    applySolidCenterStrokeExportPackets(graphic, solidCenterPackets)
    const fillHitArea =
      getRenderableFills(data.fills).length > 0
        ? createRectangleHitArea(data.width, data.height)
        : null
    ;(graphic as { hitArea: ReturnType<typeof createSolidCenterStrokeHitArea> | null })
      .hitArea = mergeHitAreas(
      fillHitArea,
      createSolidCenterStrokeHitArea(solidCenterPackets)
    )
    renderSolidCenterStrokeEntries(
      graphic,
      toSolidCenterStrokeRenderEntries(solidCenterPackets)
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
