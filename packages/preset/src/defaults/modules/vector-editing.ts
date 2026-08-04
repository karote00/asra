import { registerVectorPathEditingRenderLayer } from '../../render-layers/index.js'
import { SelectionChannels } from '../../selection/channels.js'
import { registerSelections } from '../../selection/register-default-selections.js'
import { registerVectorEditingProperties } from '../../ui/register-properties.js'
import type { PresetDefaultInstallContext } from '../types.js'
import {
  acquireVectorEditingProjection,
  registerTrackedRenderLayer
} from '../installation.js'

export const installVectorEditingDefault = (
  context: PresetDefaultInstallContext
): void => {
  context.privatePrerequisites.acquire('selection:vector-editing', () =>
    registerSelections(context.core, undefined, [
      SelectionChannels.VECTOR_POINT,
      SelectionChannels.VECTOR_SEGMENT
    ])
  )
  registerVectorEditingProperties(context.core)
  acquireVectorEditingProjection(context)
  context.privatePrerequisites.acquire('render-layer:vector-path-editing', () =>
    registerTrackedRenderLayer(context, (register) => {
      registerVectorPathEditingRenderLayer(register, {
        getSelection: (type) => context.core.getSelection(type),
        render: context.dependencies.render,
        sceneTree: context.dependencies.sceneTree,
        systemContext: context.dependencies.systemContext
      })
    })
  )
}
