import { EntityTypes } from '@asyra/utils'
import { describe, expect, it } from 'vitest'
import {
  FORMAL_WORKSPACE_ID,
  createFormalInitialDocument
} from '../../collaboration/initial-document'

describe('formal socket document at sequence zero', () => {
  it('gives every Actor the same canonical workspace root', () => {
    const first = createFormalInitialDocument()
    const second = createFormalInitialDocument()

    expect(first).toEqual({
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
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second.sceneTree).not.toBe(first.sceneTree)
    expect(second.sceneTree.elements).not.toBe(first.sceneTree.elements)
  })
})
