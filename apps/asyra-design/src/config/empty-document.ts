import type { CoreRawData } from '@asyra/utils'
import { DOCUMENT_VERSION } from './document-version'

export const createEmptyDocument = (): CoreRawData => ({
  version: DOCUMENT_VERSION,
  sceneTree: {
    workspace: '',
    workspaceList: [],
    elements: {}
  },
  props: {}
})
