import { describe, expect, it, vi } from 'vitest'
import {
  DOCUMENT_VERSION,
  LEGACY_WORKSPACE_VECTOR_VERSION
} from '../../config/document-version'
import {
  installVectorLocalGeometryMigration,
  migrateWorkspaceVectorGeometryToLocal
} from '../migrations/vector-local-geometry-migration'

const createLegacyDocument = () => ({
  version: LEGACY_WORKSPACE_VECTOR_VERSION,
  sceneTree: {
    workspace: 'workspace-1',
    workspaceList: ['workspace-1'],
    elements: {
      'workspace-1': {
        id: 'workspace-1',
        type: 'workspace',
        name: 'Workspace',
        parentId: '',
        visible: true,
        lock: false,
        children: ['group-1']
      },
      'group-1': {
        id: 'group-1',
        type: 'group',
        name: 'Group',
        parentId: 'workspace-1',
        visible: true,
        lock: false,
        children: ['vector-1'],
        props: {
          position: 'group-position',
          dimension: 'group-dimension'
        }
      },
      'vector-1': {
        id: 'vector-1',
        type: 'vector',
        name: 'Vector',
        parentId: 'group-1',
        visible: true,
        lock: false,
        props: {
          position: 'vector-position',
          dimension: 'vector-dimension',
          points: 'vector-points',
          pointCoordinateSpace: 'vector-point-space'
        }
      }
    }
  },
  props: {
    'group-position': {
      id: 'group-position',
      type: 'position',
      x: 40,
      y: 50,
      rotation: 0,
      xUnit: 'px',
      yUnit: 'px'
    },
    'group-dimension': {
      id: 'group-dimension',
      type: 'dimension',
      width: 100,
      height: 100,
      widthUnit: 'px',
      heightUnit: 'px'
    },
    'vector-position': {
      id: 'vector-position',
      type: 'position',
      x: 10,
      y: 20,
      rotation: 0,
      xUnit: 'px',
      yUnit: 'px'
    },
    'vector-dimension': {
      id: 'vector-dimension',
      type: 'dimension',
      width: 20,
      height: 20,
      widthUnit: 'px',
      heightUnit: 'px'
    },
    'vector-points': {
      id: 'vector-points',
      type: 'vectorPoints',
      points: ['point-a', 'control-a', 'point-b']
    },
    'point-a': {
      id: 'point-a',
      type: 'vectorPoint',
      kind: 'anchor',
      anchorType: 'smooth',
      handleMode: 'mirrored',
      x: 55,
      y: 77
    },
    'control-a': {
      id: 'control-a',
      type: 'vectorPoint',
      kind: 'control',
      anchorId: 'point-a',
      handleRole: 'out',
      x: 60,
      y: 80
    },
    'point-b': {
      id: 'point-b',
      type: 'vectorPoint',
      kind: 'anchor',
      anchorType: 'sharp',
      handleMode: 'none',
      x: 70,
      y: 90
    },
    'vector-point-space': {
      id: 'vector-point-space',
      type: 'custom',
      pointCoordinateSpace: 'workspace'
    }
  }
})

describe('Vector local-geometry document migration', () => {
  it('atomically converts nested workspace points to Vector-local coordinates', () => {
    const legacy = createLegacyDocument()
    const migrated = migrateWorkspaceVectorGeometryToLocal(legacy)

    expect(migrated).not.toBe(legacy)
    expect(migrated.version).toBe(DOCUMENT_VERSION)
    expect(migrated.sceneTree).toEqual(legacy.sceneTree)
    expect(migrated.props['point-a']).toMatchObject({ x: 5, y: 7 })
    expect(migrated.props['control-a']).toMatchObject({ x: 10, y: 10 })
    expect(migrated.props['point-b']).toMatchObject({ x: 20, y: 20 })
    expect(migrated.props['vector-point-space']).toMatchObject({
      pointCoordinateSpace: 'local'
    })
    expect(legacy.props['point-a']).toMatchObject({ x: 55, y: 77 })
    expect(legacy.props['vector-point-space']).toMatchObject({
      pointCoordinateSpace: 'workspace'
    })
  })

  it('fails the complete migration before returning a partial document', () => {
    const legacy = createLegacyDocument()
    legacy.props['vector-points'].points.push('missing-point')

    expect(() => migrateWorkspaceVectorGeometryToLocal(legacy)).toThrow(
      /missing-point/
    )
    expect(legacy.version).toBe(LEGACY_WORKSPACE_VECTOR_VERSION)
    expect(legacy.props['point-a']).toMatchObject({ x: 55, y: 77 })
  })

  it('installs one connected transition and bypasses the new version', () => {
    const registerLoadHook = vi.fn()
    const registrar = { registerLoadHook }

    installVectorLocalGeometryMigration(registrar)
    installVectorLocalGeometryMigration(registrar)

    expect(registerLoadHook).toHaveBeenCalledOnce()
    const hook = registerLoadHook.mock.calls[0][0]
    const current = {
      ...createLegacyDocument(),
      version: DOCUMENT_VERSION
    }
    expect(hook(current)).toBe(current)
  })
})
