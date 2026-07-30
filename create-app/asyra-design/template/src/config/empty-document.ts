import type { CoreRawData } from '@asyra/utils'

export const createEmptyDocument = (): CoreRawData => ({
  version: '1.0.0',
  sceneTree: {
    workspace: '',
    workspaceList: [],
    elements: {}
  },
  props: {}
})
