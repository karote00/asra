import {
  FillGradientTypes,
  PropertyTypes,
  type EVENT_OPTIONS,
  type FillAttrs,
  type FillGradientData,
  type PositionData
} from '@asyra/utils'
import { isEqual } from 'lodash'
import { FILL_PATCH_KEYS, type FillWritableKey } from '../constants'
import core, { render, sceneTree } from '../contexts'

export type FillPatch = Partial<Pick<FillAttrs, FillWritableKey>>

interface RenderElementShape {
  toGlobal: (point: PositionData) => PositionData
  toLocal: (
    point: PositionData,
    from?: unknown,
    targetPoint?: PositionData,
    skipUpdate?: boolean
  ) => PositionData
  parent?: unknown
}

export type GradientHandleIndex = 0 | 1

export interface GradientHandleGeometry {
  elementId: string
  fillId: string
  fill: FillAttrs
  width: number
  height: number
  canvasHandles: [PositionData, PositionData]
}

const isNonLinearGradient = (gradientType: FillGradientData['gradientType']) =>
  gradientType !== FillGradientTypes.LINEAR

const getDisplayStartHandle = (
  gradient: FillGradientData
): FillGradientData['gradientHandles'][number] => {
  const [startHandle, endHandle] = gradient.gradientHandles
  if (!startHandle || !endHandle) {
    return startHandle
  }

  if (!isNonLinearGradient(gradient.gradientType)) {
    return startHandle
  }

  return {
    x: (startHandle.x + endHandle.x) / 2,
    y: (startHandle.y + endHandle.y) / 2
  }
}

const getStoredHandleFromDisplay = (
  gradient: FillGradientData,
  handleIndex: GradientHandleIndex,
  displayHandle: { x: number; y: number }
) => {
  if (handleIndex !== 0 || !isNonLinearGradient(gradient.gradientType)) {
    return displayHandle
  }

  const endHandle = gradient.gradientHandles[1]
  if (!endHandle) {
    return displayHandle
  }

  return {
    x: displayHandle.x * 2 - endHandle.x,
    y: displayHandle.y * 2 - endHandle.y
  }
}

const getHandleDeltaScale = (
  gradient: FillGradientData,
  handleIndex: GradientHandleIndex
) => (handleIndex === 0 && isNonLinearGradient(gradient.gradientType) ? 2 : 1)

const getNextGradientForHandleWithDelta = (
  baseGradient: FillGradientData,
  handleIndex: GradientHandleIndex,
  width: number,
  height: number,
  delta: PositionData
): FillGradientData => {
  const currentHandle = baseGradient.gradientHandles[handleIndex]
  const deltaScale = getHandleDeltaScale(baseGradient, handleIndex)

  return {
    ...baseGradient,
    gradientHandles: baseGradient.gradientHandles.map((handle, index) =>
      index === handleIndex
        ? {
            x: currentHandle.x + (delta.x / width) * deltaScale,
            y: currentHandle.y + (delta.y / height) * deltaScale
          }
        : handle
    )
  }
}

const getChangedPatchEntries = (currentFill: FillAttrs, patch: FillPatch) =>
  FILL_PATCH_KEYS.flatMap((key) => {
    if (!(key in patch)) {
      return []
    }

    const nextValue = patch[key]
    return isEqual(currentFill[key], nextValue)
      ? []
      : ([[key, nextValue]] as const)
  })

const getElementFill = (
  elementId: string,
  fillId: string
): { fill: FillAttrs; width: number; height: number } | null => {
  const element = sceneTree.getElementById(elementId)
  if (!element) {
    return null
  }

  const computed = element.getAllComputedData() as Partial<{
    fills: FillAttrs[]
    width: number
    height: number
  }>
  const fills = Array.isArray(computed.fills) ? computed.fills : []
  const fill = fills.find((entry) => entry?.id === fillId)
  if (!fill) {
    return null
  }

  const width = computed.width
  const height = computed.height
  if (
    typeof width !== 'number' ||
    !Number.isFinite(width) ||
    width === 0 ||
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    height === 0
  ) {
    return null
  }

  return {
    fill,
    width,
    height
  }
}

const getCanvasPositionFromClient = (clientPos: PositionData): PositionData => {
  const canvasBounds = render.app?.canvas?.getBoundingClientRect()
  if (!canvasBounds) {
    return clientPos
  }

  return {
    x: clientPos.x - canvasBounds.left,
    y: clientPos.y - canvasBounds.top
  }
}

export const fillApis = {
  getFillById: (elementId: string, fillId: string): FillAttrs | null => {
    return getElementFill(elementId, fillId)?.fill ?? null
  },

  getNextGradientForHandleAtClientPosition: (
    elementId: string,
    fillId: string,
    handleIndex: GradientHandleIndex,
    clientPos: PositionData
  ) => {
    const geometry = fillApis.getGradientHandleGeometry(elementId, fillId)
    if (!geometry || !geometry.fill.gradient) {
      return null
    }

    const renderElement = render.getElementById(
      elementId
    ) as RenderElementShape | null
    if (!renderElement) {
      return null
    }

    const workspacePos = render.getMousePosInWorkspace({
      clientX: clientPos.x,
      clientY: clientPos.y
    })
    const localPos = renderElement.toLocal(workspacePos, renderElement.parent)
    const displayHandle = {
      x: localPos.x / geometry.width,
      y: localPos.y / geometry.height
    }
    const nextHandle = getStoredHandleFromDisplay(
      geometry.fill.gradient,
      handleIndex,
      displayHandle
    )

    return {
      ...geometry.fill.gradient,
      gradientHandles: geometry.fill.gradient.gradientHandles.map(
        (handle, index) =>
          index === handleIndex
            ? nextHandle
            : handle
      )
    }
  },

  getGradientHandleGeometry: (
    elementId: string,
    fillId: string
  ): GradientHandleGeometry | null => {
    const fillData = getElementFill(elementId, fillId)
    if (
      !fillData?.fill.gradient ||
      fillData.fill.gradient.gradientHandles.length < 2
    ) {
      return null
    }

    const renderElement = render.getElementById(
      elementId
    ) as RenderElementShape | null
    if (!renderElement) {
      return null
    }

    const [, endHandle] = fillData.fill.gradient.gradientHandles
    const displayStartHandle = getDisplayStartHandle(fillData.fill.gradient)
    const canvasHandles: [PositionData, PositionData] = [
      renderElement.toGlobal({
        x: displayStartHandle.x * fillData.width,
        y: displayStartHandle.y * fillData.height
      }),
      renderElement.toGlobal({
        x: endHandle.x * fillData.width,
        y: endHandle.y * fillData.height
      })
    ]

    return {
      elementId,
      fillId,
      fill: fillData.fill,
      width: fillData.width,
      height: fillData.height,
      canvasHandles
    }
  },

  getGradientHandleHitAtClientPos: (
    elementId: string,
    fillId: string,
    clientPos: PositionData,
    hitRadius = 9
  ): { handleIndex: GradientHandleIndex } | null => {
    const geometry = fillApis.getGradientHandleGeometry(elementId, fillId)
    if (!geometry) {
      return null
    }

    const canvasPos = getCanvasPositionFromClient(clientPos)
    const hitRadiusSquared = hitRadius * hitRadius

    for (const [handleIndex, handlePos] of geometry.canvasHandles.entries()) {
      const dx = handlePos.x - canvasPos.x
      const dy = handlePos.y - canvasPos.y
      if (dx * dx + dy * dy <= hitRadiusSquared) {
        return {
          handleIndex: handleIndex as GradientHandleIndex
        }
      }
    }

    return null
  },

  getGradientStopHitAtClientPos: (
    elementId: string,
    fillId: string,
    clientPos: PositionData,
    hitSize = 16
  ): { stopIndex: number } | null => {
    const geometry = fillApis.getGradientHandleGeometry(elementId, fillId)
    if (!geometry?.fill.gradient) {
      return null
    }

    const canvasPos = getCanvasPositionFromClient(clientPos)
    const start = geometry.canvasHandles[0]
    const end = geometry.canvasHandles[1]

    // Perpendicular offset direction (same as render layer)
    const ldx = end.x - start.x
    const ldy = end.y - start.y
    const dist = Math.max(0.001, Math.sqrt(ldx * ldx + ldy * ldy))
    const ux = ldx / dist
    const uy = ldy / dist
    const px = -uy
    const py = ux

    const stopOffsetFromLine = 8 // STOP_TRIANGLE_HEIGHT(6) + 2
    const rectHalf = hitSize / 2
    const offsetDist = stopOffsetFromLine + rectHalf

    const stops = geometry.fill.gradient.gradientStops
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i]

      // Position on the gradient line
      const lineX = start.x + (end.x - start.x) * stop.position
      const lineY = start.y + (end.y - start.y) * stop.position

      // Center of the indicator rectangle (offset perpendicular)
      const cx = lineX + px * offsetDist
      const cy = lineY + py * offsetDist

      // Hit-test using rotated rectangle: project click into the rect's local space
      const relX = canvasPos.x - cx
      const relY = canvasPos.y - cy

      // Rotate into the gradient-aligned coordinate system
      const localAlongLine = relX * ux + relY * uy
      const localPerpLine = relX * px + relY * py

      if (
        Math.abs(localAlongLine) <= rectHalf &&
        Math.abs(localPerpLine) <= rectHalf
      ) {
        return { stopIndex: i }
      }
    }

    return null
  },

  updateGradientHandleAtClientPosition: (
    elementId: string,
    fillId: string,
    handleIndex: GradientHandleIndex,
    clientPos: PositionData,
    options?: EVENT_OPTIONS
  ) => {
    const geometry = fillApis.getGradientHandleGeometry(elementId, fillId)
    const nextGradient = fillApis.getNextGradientForHandleAtClientPosition(
      elementId,
      fillId,
      handleIndex,
      clientPos
    )
    if (!geometry || !geometry.fill.gradient || !nextGradient) {
      return null
    }

    fillApis.updateFillField(
      elementId,
      fillId,
      geometry.fill,
      'gradient',
      nextGradient,
      options
    )

    return nextGradient
  },

  getNextGradientForHandleWithWorkspaceDelta: (
    elementId: string,
    fillId: string,
    handleIndex: GradientHandleIndex,
    baseGradient: FillGradientData,
    delta: PositionData
  ) => {
    const fillData = getElementFill(elementId, fillId)
    if (!fillData) {
      return null
    }

    return getNextGradientForHandleWithDelta(
      baseGradient,
      handleIndex,
      fillData.width,
      fillData.height,
      delta
    )
  },

  updateGradientHandleWithWorkspaceDelta: (
    elementId: string,
    fillId: string,
    handleIndex: GradientHandleIndex,
    baseGradient: FillGradientData,
    delta: PositionData,
    options?: EVENT_OPTIONS
  ) => {
    const fillData = getElementFill(elementId, fillId)
    if (!fillData) {
      return null
    }

    const nextGradient = getNextGradientForHandleWithDelta(
      baseGradient,
      handleIndex,
      fillData.width,
      fillData.height,
      delta
    )

    fillApis.updateFillField(
      elementId,
      fillId,
      fillData.fill,
      'gradient',
      nextGradient,
      options
    )

    return nextGradient
  },

  updateFillFields: (
    elementId: string,
    fillId: string,
    currentFill: FillAttrs,
    patch: FillPatch,
    options?: EVENT_OPTIONS
  ) => {
    const changedEntries = getChangedPatchEntries(currentFill, patch)
    if (changedEntries.length === 0) {
      return
    }

    changedEntries.forEach(([key, value]) => {
      core.updatePropertyById(
        fillId,
        key,
        value,
        {
          ownerElementId: elementId,
          ownerPropertyName: PropertyTypes.FILLS
        },
        options
      )
    })
    core.commitPropertyChanges(options)
  },
  updateFillField: <K extends FillWritableKey>(
    elementId: string,
    fillId: string,
    currentFill: FillAttrs,
    key: K,
    value: FillAttrs[K],
    options?: EVENT_OPTIONS
  ) => {
    fillApis.updateFillFields(
      elementId,
      fillId,
      currentFill,
      {
        [key]: value
      } as FillPatch,
      options
    )
  }
}
