import core from '../contexts'
import { inputSystem, interactionCore, systemContext } from '../contexts'

export const initFeatures = (): void => {
  core.initFeatureSystem({
    inputSystem,
    systemContext,
    interactionCore
  })
}
