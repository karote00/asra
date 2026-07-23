import { registerSelectionOverlayRenderLayer } from '../../render-layers'
import { SelectionChannels } from '../../selection/channels'
import { registerSelections } from '../../selection/register-default-selections'
import { registerSelectionProperties } from '../../ui/register-properties'
import type { PresetDefaultInstallContext } from '../types'
import {
  acquireFrameworkEvents,
  acquireSelectionProjection,
  registerTrackedRenderLayer
} from '../installation'

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
