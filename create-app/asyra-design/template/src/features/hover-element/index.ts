import { defineFeature, EventTypes } from '@asyra/core'
import type { RenderPointerPayload, SystemContextSnapshot } from '@asyra/utils'
import { elementApis, systemContextApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
import { resolveCurrentCanvasHierarchyTarget } from '../../controllers/canvas-hierarchy-target'

const publishHoveredElementId = (elementId: string | null) => {
  if (
    elementId &&
    !elementApis.isElementLocked(elementId) &&
    elementApis.isElementVisible(elementId)
  ) {
    systemContextApis.updateHoveredElementId(elementId)
    return { hoveredId: elementId }
  }

  systemContextApis.updateHoveredElementId(null)
  return { hoveredId: null }
}

const resolveHoveredElementId = (
  rawElementId: string | null,
  snapshot: Pick<SystemContextSnapshot, 'keyMeta' | 'keyCtrl'>
) => {
  const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
  if (
    pathEditingVectorId &&
    rawElementId &&
    rawElementId !== pathEditingVectorId
  ) {
    return null
  }

  return resolveCurrentCanvasHierarchyTarget(rawElementId, snapshot)
}

/**
 * Hover Element Feature
 * Coordinates hover state across the system.
 *
 * This feature now relies exclusively on renderer feedback (render.* events)
 * for precise, geometry-aware hover detection.
 */
export const hoverElementFeature = defineFeature(
  FeatureNames.HOVER_ELEMENT,
  InputSystemEvents.INPUT_MOUSE_MOVE,
  {
    priority: 0,
    exclusive: false,
    execution: (snapshot: SystemContextSnapshot) => {
      if (snapshot.mouseDragging) {
        return null
      }

      const rawElementId = elementApis.getRenderElementIdAtClientPos(
        snapshot.mousePosition
      )
      return publishHoveredElementId(
        resolveHoveredElementId(rawElementId, snapshot)
      )
    }
  }
)

/**
 * Passive Render Hover - Precise hit testing from Pixi.js
 * Triggered automatically by the feature system for 'render.*' events.
 */
export const hoverElementRenderHoverFeature = defineFeature(
  FeatureNames.HOVER_ELEMENT + '.render.hover',
  EventTypes.POINTER_HOVER,
  {
    priority: 10,
    exclusive: false,
    execution: (snapshot: SystemContextSnapshot) => {
      if (snapshot.mouseDragging) {
        return null
      }

      const payload = (snapshot.detail ?? snapshot.payload) as
        RenderPointerPayload | undefined
      if (payload?.targetKind && payload.targetKind !== 'element') {
        return null
      }
      const rawElementId = payload?.elementId ?? null
      return publishHoveredElementId(
        resolveHoveredElementId(rawElementId, snapshot)
      )
    }
  }
)

/**
 * Passive Render Leave - Precise hit testing from Pixi.js
 * Triggered automatically by the feature system for 'render.*' events.
 */
export const hoverElementRenderLeaveFeature = defineFeature(
  FeatureNames.HOVER_ELEMENT + '.render.leave',
  EventTypes.POINTER_LEAVE,
  {
    priority: 10,
    exclusive: false,
    execution: (snapshot) => {
      if (snapshot.mouseDragging) {
        return null
      }

      const payload = (snapshot.detail ?? snapshot.payload) as
        RenderPointerPayload | undefined
      if (payload?.targetKind && payload.targetKind !== 'element') {
        return null
      }
      systemContextApis.updateHoveredElementId(null)
      return { hoveredId: null }
    }
  }
)
