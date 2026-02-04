import {
  initFeatureSystem,
  inputSystem,
  interactionCore,
  systemContext
} from '../contexts'

export const initFeatures = (): void => {
  initFeatureSystem({
    inputSystem,
    systemContext,
    interactionCore
  })
}
