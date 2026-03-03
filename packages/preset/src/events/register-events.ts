import { registerEventDefinitions } from '@asyra/core'
import {
  PresetEventDefinitions,
  type PresetEventDefinitions as PresetEventDefinitionsType
} from './preset-event-names'
import type { PresetCoreAPIs } from '../types'

export const registerEvents = (
  core: Pick<PresetCoreAPIs, 'registerEvent'>
): Record<keyof PresetEventDefinitionsType, ReturnType<PresetCoreAPIs['registerEvent']>> =>
  registerEventDefinitions(PresetEventDefinitions, (definition) =>
    core.registerEvent(definition)
  )
