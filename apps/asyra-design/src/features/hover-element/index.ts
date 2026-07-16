import { defineFeature, EventTypes } from '@asyra/core'
import type { RenderPointerPayload } from '@asyra/utils'
import { elementApis, systemContextApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'

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
    exclusive: false
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
    execution: (snapshot) => {
      if (snapshot.mouseDragging) {
        return null
      }

      const payload = (snapshot.detail ?? snapshot.payload) as
        | RenderPointerPayload
        | undefined
      if (payload?.targetKind && payload.targetKind !== 'element') {
        return null
      }
      const elementId = payload?.elementId

      if (elementId) {
        const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
        if (pathEditingVectorId && elementId !== pathEditingVectorId) {
          systemContextApis.updateHoveredElementId(null)
          return { hoveredId: null }
        }

        if (
          elementApis.isElementLocked(elementId) ||
          !elementApis.isElementVisible(elementId)
        ) {
          systemContextApis.updateHoveredElementId(null)
          return { hoveredId: null }
        }

        systemContextApis.updateHoveredElementId(elementId)
        return { hoveredId: elementId }
      }

      systemContextApis.updateHoveredElementId(null)
      return { hoveredId: null }
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
        | RenderPointerPayload
        | undefined
      if (payload?.targetKind && payload.targetKind !== 'element') {
        return null
      }
      systemContextApis.updateHoveredElementId(null)
      return { hoveredId: null }
    }
  }
)
