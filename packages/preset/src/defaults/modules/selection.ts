import { registerSelectionOverlayRenderLayer } from '../../render-layers/index.js'
import { SelectionChannels } from '../../selection/channels.js'
import { registerSelections } from '../../selection/register-default-selections.js'
import { registerSelectionProperties } from '../../ui/register-properties.js'
import type { PresetDefaultInstallContext } from '../types.js'
import {
  acquireFrameworkEvents,
  acquireSelectionProjection,
  registerTrackedRenderLayer
} from '../installation.js'

export const installSelectionDefault = (
  context: PresetDefaultInstallContext
): void => {
  acquireFrameworkEvents(context)
  context.privatePrerequisites.acquire('selection:element', () =>
    registerSelections(context.core, undefined, [SelectionChannels.ELEMENT])
  )
  registerSelectionProperties(context.core)
  acquireSelectionProjection(context)
  context.privatePrerequisites.acquire('render-layer:selection-overlay', () =>
    registerTrackedRenderLayer(context, (register) => {
      registerSelectionOverlayRenderLayer(register, {
        render: context.dependencies.render,
        sceneTree: context.dependencies.sceneTree,
        systemContext: context.dependencies.systemContext,
        getSelection: (type) => context.core.getSelection(type)
      })
    })
  )
}
