import { measureBrowserDragAsyncPhase } from '@asyra/utils'
import type { AsyraDesignAiDeliveryMode } from './ai/actions'
import {
  readAsyraDesignServerResponse,
  type AsyraDesignServerResponseRecord
} from './ai/server-response-inbox'
import { getRequiredFileId } from './render-app/collaboration-mode'
import { initApp, type AppInitialization } from './init/init-app'

interface AsyraDesignAppStartupFactories {
  readonly getRequiredFileId: () => string
  readonly initializeApp: typeof initApp
  readonly readServerResponse: (
    fileId: string
  ) => Promise<AsyraDesignServerResponseRecord | null>
}

const defaultFactories: AsyraDesignAppStartupFactories = {
  getRequiredFileId,
  initializeApp: initApp,
  readServerResponse: readAsyraDesignServerResponse
}

export const startAsyraDesignApp = async (
  input: {
    readonly deliveryMode: AsyraDesignAiDeliveryMode
    readonly render: (initialization: AppInitialization) => void
  },
  factories: AsyraDesignAppStartupFactories = defaultFactories
): Promise<AppInitialization> => {
  const fileId = factories.getRequiredFileId()
  const response = await measureBrowserDragAsyncPhase(
    'ai-server-response-inbox:preload-file-response',
    () => factories.readServerResponse(fileId)
  )
  const initialization = factories.initializeApp({
    aiDeliveryMode: input.deliveryMode,
    serverResponse: response
  })
  input.render(initialization)
  return initialization
}
