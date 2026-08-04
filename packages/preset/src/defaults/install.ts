import { PRESET_APPLY_ERROR_CODES, PresetDefaults } from '../constants.js'
import { PresetApplyError } from '../composition/error.js'
import type {
  PresetCoreAPIs,
  PresetDefaultId,
  PresetDependencies
} from '../types.js'
import { installBasicShapesDefault } from './modules/basic-shapes.js'
import { installContainersDefault } from './modules/containers.js'
import { installVectorDefault } from './modules/vector.js'
import { installInputDefault } from './modules/input.js'
import { installSelectionDefault } from './modules/selection.js'
import { installVectorEditingDefault } from './modules/vector-editing.js'
import { installViewportDefault } from './modules/viewport.js'
import { installUIContextDefault } from './modules/ui-context.js'
import { createPrivatePrerequisiteManager } from './private-manager.js'
import { createOwnedStateCleanup } from './owned-state.js'
import type {
  PresetDefaultInstallContext,
  RegisterPresetCleanup
} from './types.js'

interface PresetDefaultModule {
  readonly id: PresetDefaultId
  readonly install: (context: PresetDefaultInstallContext) => void
}

const presetDefaultModules: PresetDefaultModule[] = [
  { id: PresetDefaults.BASIC_SHAPES, install: installBasicShapesDefault },
  { id: PresetDefaults.CONTAINERS, install: installContainersDefault },
  { id: PresetDefaults.VECTOR, install: installVectorDefault },
  { id: PresetDefaults.INPUT, install: installInputDefault },
  { id: PresetDefaults.SELECTION, install: installSelectionDefault },
  {
    id: PresetDefaults.VECTOR_EDITING,
    install: installVectorEditingDefault
  },
  { id: PresetDefaults.VIEWPORT, install: installViewportDefault },
  { id: PresetDefaults.UI_CONTEXT, install: installUIContextDefault }
]
presetDefaultModules.forEach(Object.freeze)

export const PRESET_DEFAULT_MODULES: readonly PresetDefaultModule[] =
  Object.freeze(presetDefaultModules)

export interface InstallPresetDefaultsInput {
  readonly core: PresetCoreAPIs
  readonly dependencies: PresetDependencies
  readonly appliedDefaults: readonly PresetDefaultId[]
  readonly registerCleanup: RegisterPresetCleanup
}

export const installPresetDefaults = ({
  core,
  dependencies,
  appliedDefaults,
  registerCleanup
}: InstallPresetDefaultsInput): readonly PresetDefaultId[] => {
  const requested = new Set(appliedDefaults)
  const privatePrerequisites = createPrivatePrerequisiteManager(registerCleanup)
  const context: PresetDefaultInstallContext = {
    core,
    dependencies,
    privatePrerequisites
  }
  const installed: PresetDefaultId[] = []

  PRESET_DEFAULT_MODULES.forEach((module) => {
    if (!requested.has(module.id)) return
    registerCleanup(
      `default:${module.id}:owned-state`,
      createOwnedStateCleanup(core)
    )
    try {
      module.install(context)
      installed.push(module.id)
    } catch (cause) {
      throw new PresetApplyError(
        PRESET_APPLY_ERROR_CODES.DEFAULT_INSTALL_FAILED,
        `Preset default "${module.id}" failed to install`,
        { cause, defaultId: module.id }
      )
    }
  })

  return Object.freeze([...installed])
}
