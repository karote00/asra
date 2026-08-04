import { EntityTypes, type CoreRawData } from '@asyra/utils'

export const FORMAL_WORKSPACE_ID = 'workspace'

export const createFormalInitialDocument = (): CoreRawData => ({
  version: '1.0.0',
  sceneTree: {
    workspace: FORMAL_WORKSPACE_ID,
    workspaceList: [FORMAL_WORKSPACE_ID],
    elements: {
      [FORMAL_WORKSPACE_ID]: {
        id: FORMAL_WORKSPACE_ID,
        name: 'Workspace',
        type: EntityTypes.WORKSPACE,
        parentId: '',
        visible: true,
        lock: false,
        children: []
      }
    }
  },
  props: {}
})
