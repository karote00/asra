/**
 * Register all rules with interactionCore
 * This binds rules to input events so workflows can execute them
 */

import core from '@asyra/core'
import {
  decideFromCreateElementRules,
  decideFromSelectRules,
  decideZoomFitRules,
  decidePanZoomRules,
  decideUndoRedoRules,
  decideFromResizeElementRules,
  decideFromResetElementSizeRules
} from './rules'

export const registerRules = () => {
  // drag.start: create element or select
  core.registerInteraction('input.drag.start', (snapshot) => {
    const { primaryTool } = snapshot
    if (primaryTool === 'select') {
      return decideFromSelectRules(snapshot)
    }
    if (primaryTool === 'rectangle') {
      return decideFromCreateElementRules(snapshot)
    }
    return null
  })

  // drag.update: resize element
  core.registerInteraction('input.drag.update', (snapshot) => {
    const { primaryTool } = snapshot
    if (primaryTool === 'rectangle') {
      return decideFromResizeElementRules(snapshot)
    }
    return null
  })

  // drag.end: reset element size
  core.registerInteraction('input.drag.end', (snapshot) => {
    const { primaryTool } = snapshot
    if (primaryTool === 'rectangle') {
      return decideFromResetElementSizeRules(snapshot)
    }
    return null
  })

  core.registerInteraction('input.wheel.scroll', (snapshot, raw) => {
    const keySnapshot = {
      meta: raw?.modifiers?.meta || false,
      shift: raw?.modifiers?.shift || false,
      ctrl: raw?.modifiers?.ctrl || false,
      alt: raw?.modifiers?.alt || false
    }
    const mouseSnapshot = raw?.pointer || {}
    return decidePanZoomRules(keySnapshot, mouseSnapshot)
  })

  core.registerInteraction('input.shortcut.zoomPreset', () =>
    decideZoomFitRules()
  )

  core.registerInteraction('input.shortcut.undoredo', (snapshot, raw) => {
    const keySnapshot = {
      meta: raw?.modifiers?.meta || false,
      shift: raw?.modifiers?.shift || false,
      ctrl: raw?.modifiers?.ctrl || false,
      alt: raw?.modifiers?.alt || false
    }
    return decideUndoRedoRules(keySnapshot)
  })

  core.registerInteraction('input.mouse.move', (snapshot) =>
    decideFromSelectRules(snapshot)
  )
}
