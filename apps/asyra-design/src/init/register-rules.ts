/**
 * Register all rules with interactionCore
 * This binds rules to input events so workflows can execute them
 */

import core from '@asyra/core'
import {
  decideFromSelectRules,
  decideZoomFitRules,
  decidePanZoomRules,
  decideUndoRedoRules
} from './rules'

export const registerRules = () => {
  // Note: create-element (rectangle tool) is now handled by feature-system
  // Only select is handled here for now (80% refactored)

  // drag.start: select (only for select tool)
  core.registerInteraction('input.drag.start', (snapshot) => {
    const { primaryTool } = snapshot
    if (primaryTool === 'select') {
      return decideFromSelectRules(snapshot)
    }
    return null
  })

  // Note: drag.update and drag.end for rectangle (resize/reset) are now handled by feature-system
  // Only keeping select-related drag handlers

  // drag.update: select logic (maintained for 80% refactor)
  core.registerInteraction('input.drag.update', (snapshot) => {
    const { primaryTool } = snapshot
    if (primaryTool === 'select') {
      return decideFromSelectRules(snapshot)
    }
    return null
  })

  // drag.end: select logic (maintained for 80% refactor)
  core.registerInteraction('input.drag.end', (snapshot) => {
    const { primaryTool } = snapshot
    if (primaryTool === 'select') {
      return decideFromSelectRules(snapshot)
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

  // Note: input.mouse.move is now handled by hover-element feature-system
  // Old registration disabled - hover detection is managed by feature-system
}
