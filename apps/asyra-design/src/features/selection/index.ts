import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'

export const selectionFeature = defineFeature('selection', undefined, {
  name: 'selection',
  api: {
    // Selection handled via @asyra/selection package subscriptions
    getSelectedIds: () => core.deps.selection.getElementSelectionIds()
  },
  define: () => {
    // Selection handled by @asyra/selection package subscribers
  }
})

export default selectionFeature
