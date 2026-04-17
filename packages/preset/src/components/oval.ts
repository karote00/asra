import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_OVAL_FILLS, getRenderableFills } from './fills'
import { createEllipseHitArea, mergeHitAreas } from './shape-hit-area'
import { DEFAULT_OVAL_STROKES } from './stroke-render/constants'
import { renderSolidCenterStrokeEntries } from './stroke-render/solid-center-stroke-render'
import { buildEllipseLoop } from './stroke-render/ellipse-path'
import {
  applySolidCenterStrokeExportPackets,
  buildSolidCenterStrokeResolvedPackets,
  createSolidCenterStrokeHitArea,
  toSolidCenterStrokeRenderEntries
} from './stroke-render/solid-center-stroke-packets'

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
    const solidCenterPackets = buildSolidCenterStrokeResolvedPackets(
      `oval:${data.id ?? 'anonymous'}`,
      buildEllipseLoop(data.width, data.height),
      true,
      data.strokes
    )
    applySolidCenterStrokeExportPackets(graphic, solidCenterPackets)
    const fillHitArea =
      getRenderableFills(data.fills).length > 0
        ? createEllipseHitArea(data.width, data.height)
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

    graphic.x = data.x
    graphic.y = data.y

    // Ensure graphic is rendered (force update in E2E)
    graphic.renderable = true
    graphic.visible = true
  }
})
