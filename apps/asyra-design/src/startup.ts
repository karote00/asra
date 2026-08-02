import { measureBrowserDragAsyncPhase } from '@asyra/utils'
import {
  readServerResponse,
  type ServerResponseRecord
} from './ai/server-response-inbox'
import { getRequiredFileId } from './render-app/collaboration-mode'
import { initApp, type AppInitialization } from './init/init-app'

interface AppStartupFactories {
  readonly getRequiredFileId: () => string
  readonly initializeApp: typeof initApp
  readonly readServerResponse: (
    fileId: string
  ) => Promise<ServerResponseRecord | null>
}

const defaultFactories: AppStartupFactories = {
  getRequiredFileId,
  initializeApp: initApp,
  readServerResponse: readServerResponse
}

export const startApp = async (
  input: {
    readonly render: (initialization: AppInitialization) => void
  },
  factories: AppStartupFactories = defaultFactories
): Promise<AppInitialization> => {
  const fileId = factories.getRequiredFileId()
  const response = await measureBrowserDragAsyncPhase(
    'ai-server-response-inbox:preload-file-response',
    () => factories.readServerResponse(fileId)
  )
  const initialization = factories.initializeApp({
    serverResponse: response
  })
  input.render(initialization)
  return initialization
}
