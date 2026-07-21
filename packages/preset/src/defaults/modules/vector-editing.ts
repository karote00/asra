import { registerVectorPathEditingRenderLayer } from '../../render-layers'
import { SelectionChannels } from '../../selection/channels'
import { registerSelections } from '../../selection/register-default-selections'
import { registerVectorEditingProperties } from '../../ui/register-properties'
import type { PresetDefaultInstallContext } from '../types'
import {
  acquireVectorEditingProjection,
  registerTrackedRenderLayer
} from '../installation'

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
