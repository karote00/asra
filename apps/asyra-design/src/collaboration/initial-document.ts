import type { AppDocumentData } from './app-protocol-types'

export const FORMAL_WORKSPACE_ID = 'workspace'

export const createFormalInitialDocument = (): AppDocumentData => ({
  version: '1.0.0',
  sceneTree: {
    workspace: FORMAL_WORKSPACE_ID,
    workspaceList: [FORMAL_WORKSPACE_ID],
    elements: {
      [FORMAL_WORKSPACE_ID]: {
        id: FORMAL_WORKSPACE_ID,
        name: 'Workspace',
        type: 'workspace',
        parentId: '',
        visible: true,
        lock: false,
        children: []
      }
    }
  },
  props: {}
})
