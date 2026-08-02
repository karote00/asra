import { getRequiredFileId } from './render-app/collaboration-mode'
import { initApp, type AppInitialization } from './init/init-app'

interface AppStartupFactories {
  readonly getRequiredFileId: () => string
  readonly initializeApp: typeof initApp
}

const defaultFactories: AppStartupFactories = {
  getRequiredFileId,
  initializeApp: initApp
}

export const startApp = async (
  input: {
    readonly render: (initialization: AppInitialization) => void
  },
  factories: AppStartupFactories = defaultFactories
): Promise<AppInitialization> => {
  factories.getRequiredFileId()
  const initialization = factories.initializeApp()
  input.render(initialization)
  return initialization
}
