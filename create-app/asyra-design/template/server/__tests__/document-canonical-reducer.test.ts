import { describe, expect, it } from 'vitest'
import type { CanonicalChange } from '@asyra/core'
import type { CoreRawData } from '@asyra/utils'
import { resolve } from 'node:path'
import { createFormalInitialDocument } from '../../src/collaboration/initial-document'
import { createFileDocumentMaterializationStore } from '../document-backend-store'
import { applyCanonicalChangesToDocument } from '../document-canonical-reducer'

const initialDocument = (): CoreRawData => ({
  version: '1.0.0',
  sceneTree: {
    workspace: 'workspace',
    workspaceList: ['workspace'],
    elements: {
      workspace: {
        id: 'workspace',
        name: 'Workspace',
        type: 'workspace' as never,
        parentId: '',
        visible: true,
        lock: false,
        children: []
      }
    }
  },
  props: {}
})

const apply = (
  document: CoreRawData,
  changes: readonly CanonicalChange[]
): CoreRawData => applyCanonicalChangesToDocument(document, changes)

describe('backend canonical document reducer', () => {
  it('uses the formal sequence-zero document for a new backend checkpoint', async () => {
    const store = createFileDocumentMaterializationStore(
      resolve(
        process.cwd(),
        'server/__tests__/.nonexistent-formal-document-store'
      )
    )

    await expect(
      store.readCheckpoint('formal-initial-document')
    ).resolves.toEqual({
      document: createFormalInitialDocument(),
      durableSequence: 0,
      publicationSequences: {},
      batches: {}
    })
  })

  it('applies property relationship records, values, and element data without mutating the checkpoint input', () => {
    const document = initialDocument()
    document.sceneTree.elements.element = {
      id: 'element',
      name: 'Before',
      type: 'rectangle' as never,
      parentId: 'workspace',
      visible: true,
      lock: false,
      props: {
        position: 'position'
      }
    }
    ;(
      document.sceneTree.elements
        .workspace as typeof document.sceneTree.elements.workspace & {
        children: string[]
      }
    ).children.push('element')
    document.props.position = {
      id: 'position',
      type: 'position' as never,
      x: 0,
      y: 0,
      records: ['stale']
    }
    document.props.stale = {
      id: 'stale',
      type: 'record' as never,
      value: 1
    }

    const next = apply(document, [
      {
        kind: 'property-components',
        records: [
          {
            propertyId: 'position',
            key: 'records',
            set: {
              fresh: {
                id: 'fresh',
                type: 'record',
                value: 2
              }
            },
            remove: ['stale']
          }
        ],
        updates: [
          {
            propertyId: 'position',
            values: { x: 25 }
          }
        ]
      },
      {
        kind: 'element-data',
        changes: [
          {
            action: 'update-element-data' as never,
            eventName: 'update-element-data',
            id: 'element',
            changes: [
              {
                key: 'name',
                before: 'Before',
                after: 'After'
              }
            ]
          }
        ]
      }
    ])

    expect(next.props.position).toMatchObject({
      x: 25,
      records: ['fresh']
    })
    expect(next.props.fresh).toEqual({
      id: 'fresh',
      type: 'record',
      value: 2
    })
    expect(next.props.stale).toBeUndefined()
    expect(next.sceneTree.elements.element.name).toBe('After')
    expect(document.props.position).toMatchObject({
      x: 0,
      records: ['stale']
    })
    expect(document.props.stale).toEqual({
      id: 'stale',
      type: 'record',
      value: 1
    })
    expect(document.sceneTree.elements.element.name).toBe('Before')
  })

  it('creates, moves, and removes exact canonical elements with their owned properties', () => {
    const document = initialDocument()
    const created = apply(document, [
      {
        kind: 'element-creation',
        parentId: 'workspace',
        index: 0,
        elements: [
          {
            id: 'group',
            name: 'Group',
            type: 'group' as never,
            parentId: 'workspace',
            visible: true,
            lock: false,
            children: []
          },
          {
            id: 'element',
            name: 'Element',
            type: 'rectangle' as never,
            parentId: 'workspace',
            visible: true,
            lock: false,
            props: { position: 'position' }
          }
        ],
        properties: [
          {
            id: 'position',
            type: 'position' as never,
            x: 1,
            y: 2
          }
        ]
      }
    ])

    const moved = apply(created, [
      {
        kind: 'hierarchy-moves',
        moves: [
          {
            elementId: 'element',
            before: { parentId: 'workspace', index: 1 },
            after: { parentId: 'group', index: 0 }
          }
        ]
      }
    ])
    expect(
      (
        moved.sceneTree.elements
          .group as typeof moved.sceneTree.elements.group & {
          children: string[]
        }
      ).children
    ).toEqual(['element'])
    expect(moved.sceneTree.elements.element.parentId).toBe('group')

    const removed = apply(moved, [
      {
        kind: 'element-removal',
        removals: [
          {
            data: moved.sceneTree.elements.element,
            parentId: 'group',
            index: 0
          }
        ]
      }
    ])
    expect(removed.sceneTree.elements.element).toBeUndefined()
    expect(removed.props.position).toBeUndefined()
  })

  it('removes the complete shared and cyclic owned-property closure exactly once', () => {
    const document = initialDocument()
    const element = {
      id: 'element',
      name: 'Element',
      type: 'rectangle' as never,
      parentId: 'workspace',
      visible: true,
      lock: false,
      props: { root: 'property-root' }
    }
    document.sceneTree.elements.element = element
    ;(
      document.sceneTree.elements
        .workspace as typeof document.sceneTree.elements.workspace & {
        children: string[]
      }
    ).children.push('element')
    document.props['property-root'] = {
      id: 'property-root',
      type: 'root' as never,
      children: ['property-left', 'property-right']
    }
    document.props['property-left'] = {
      id: 'property-left',
      type: 'branch' as never,
      child: 'property-leaf'
    }
    document.props['property-right'] = {
      id: 'property-right',
      type: 'branch' as never,
      child: 'property-leaf'
    }
    document.props['property-leaf'] = {
      id: 'property-leaf',
      type: 'leaf' as never,
      owner: 'property-root'
    }
    document.props.unrelated = {
      id: 'unrelated',
      type: 'unrelated' as never,
      value: 1
    }

    const removed = apply(document, [
      {
        kind: 'element-removal',
        removals: [
          {
            data: element,
            parentId: 'workspace',
            index: 0
          }
        ]
      }
    ])

    expect(removed.props).toEqual({
      unrelated: document.props.unrelated
    })
    expect(document.props).toHaveProperty('property-root')
    expect(document.props).toHaveProperty('property-leaf')
  })

  it('removes and restores one exact subtree checkpoint including property components', () => {
    const document = initialDocument()
    const group = {
      id: 'group',
      name: 'Group',
      type: 'group' as never,
      parentId: 'workspace',
      visible: true,
      lock: false,
      children: ['element']
    }
    const element = {
      id: 'element',
      name: 'Element',
      type: 'rectangle' as never,
      parentId: 'group',
      visible: true,
      lock: false,
      props: { position: 'position' }
    }
    document.sceneTree.elements.group = group
    document.sceneTree.elements.element = element
    ;(
      document.sceneTree.elements
        .workspace as typeof document.sceneTree.elements.workspace & {
        children: string[]
      }
    ).children.push('group')
    const position = {
      id: 'position',
      type: 'position' as never,
      x: 1,
      y: 2
    }
    document.props.position = position
    const sceneSnapshot = {
      elementId: 'group',
      removed: [
        { elementId: 'element', parentId: 'group', index: 0, data: element },
        {
          elementId: 'group',
          parentId: 'workspace',
          index: 0,
          data: group
        }
      ],
      rootParentChildrenAfter: []
    }

    const removed = apply(document, [
      {
        kind: 'subtree-removal',
        change: {
          action: 'remove-subtree' as never,
          undoAction: 'restore-subtree' as never,
          eventName: 'remove-subtree',
          ...sceneSnapshot
        }
      }
    ])
    expect(removed.sceneTree.elements.group).toBeUndefined()
    expect(removed.sceneTree.elements.element).toBeUndefined()
    expect(removed.props.position).toBeUndefined()

    const restored = apply(removed, [
      {
        kind: 'subtree-restore',
        sceneSnapshot,
        propsSnapshot: { components: [position] }
      }
    ])
    expect(restored.sceneTree.elements.group).toEqual(group)
    expect(restored.sceneTree.elements.element).toEqual(element)
    expect(restored.props.position).toEqual(position)
    expect(
      (
        restored.sceneTree.elements
          .workspace as typeof restored.sceneTree.elements.workspace & {
          children: string[]
        }
      ).children
    ).toEqual(['group'])
  })
})
