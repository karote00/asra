import { defineComponent } from '@asyra/core'
import { PropertyTypes, setElementGeometryLocalBounds } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_OVAL_FILLS, getRenderableFills } from './fills'
import { createEllipseHitArea, mergeHitAreas } from './shape-hit-area'
import { DEFAULT_OVAL_STROKES } from './stroke-render/constants'
import { buildConstrainedSolidStrokeResolvedPackets } from './stroke-render/constrained-solid-stroke-packets'
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
    setElementGeometryLocalBounds(graphic, {
      x: 0,
      y: 0,
      width: data.width,
      height: data.height
    })
    const pathPoints = buildEllipseLoop(data.width, data.height)
    const strokePackets = [
      ...buildSolidCenterStrokeResolvedPackets(
        `oval:${data.id ?? 'anonymous'}:center`,
        pathPoints,
        true,
        data.strokes
      ),
      ...buildConstrainedSolidStrokeResolvedPackets(
        `oval:${data.id ?? 'anonymous'}:constrained`,
        pathPoints,
        true,
        data.strokes
      )
    ]
    applySolidCenterStrokeExportPackets(graphic, strokePackets)
    const fillHitArea =
      getRenderableFills(data.fills).length > 0
        ? createEllipseHitArea(data.width, data.height)
        : null
    ;(graphic as { hitArea: ReturnType<typeof createSolidCenterStrokeHitArea> | null })
      .hitArea = mergeHitAreas(
      fillHitArea,
      createSolidCenterStrokeHitArea(strokePackets)
    )
    renderSolidCenterStrokeEntries(
      graphic,
      toSolidCenterStrokeRenderEntries(strokePackets)
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
