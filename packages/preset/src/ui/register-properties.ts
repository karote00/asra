import {
  SCENE_TREE_ACTIONS,
  DefaultMoseSnapshot,
  DefaultSystemSnapshot,
  DefaultTargetSnapshot,
  DefaultKeySnapshot
} from '@asyra/utils'
import type { VectorPointTarget } from '@asyra/core'
import type { PresetCoreAPIs } from '../types'

const DEFAULT_PRIMARY_TOOL = 'select'

interface SelectedVectorPointState extends Record<string, unknown> {
  elementId: string
  pointId: string
  index: number
  target: VectorPointTarget
  x: number
  y: number
}

interface SelectedVectorSegmentState extends Record<string, unknown> {
  elementId: string
  segmentId: string
}

interface ElementPanelData extends Record<string, unknown> {
  id: string
  name: string
  type: string
  lock: boolean
  visible: boolean
}

export const registerProperties = (core: PresetCoreAPIs): void => {
  core.registerUIProperty<Set<string>>('elementSelection', {
    defaultValue: new Set()
  })

  core.registerUIProperty<Set<string>>('vectorPointSelection', {
    defaultValue: new Set()
  })

  core.registerUIProperty<Set<string>>('vectorSegmentSelection', {
    defaultValue: new Set()
  })

  core.registerUIProperty<string[]>('flattenedElementIds', {
    defaultValue: []
  })

  core.registerUIProperty<Record<string, ElementPanelData>>('elementDataMap', {
    defaultValue: {}
  })

  core.registerUIProperty<number | string>('x', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'x',
      onSelectionChange: true
    }
  })

  core.registerUIProperty<number | string>('y', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'y',
      onSelectionChange: true
    }
  })

  core.registerUIProperty<number | string>('width', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'width',
      onSelectionChange: true
    }
  })

  core.registerUIProperty<number | string>('height', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'height',
      onSelectionChange: true
    }
  })

  core.registerUIProperty<number | string>('rotation', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'rotation',
      onSelectionChange: true
    }
  })

  const zoomObservable = core.registerSystemProperty<number>('zoom', 1)
  core.registerUIProperty<number>('zoom', {
    defaultValue: 1,
    source$: zoomObservable
  })

  const primaryToolObservable = core.registerSystemProperty<string>(
    'primaryTool',
    DEFAULT_PRIMARY_TOOL
  )
  core.registerUIProperty<string>('primaryTool', {
    defaultValue: DEFAULT_PRIMARY_TOOL,
    source$: primaryToolObservable
  })

  core.registerSystemProperty('systemMode', DefaultSystemSnapshot.mode)
  core.registerSystemProperty(
    'systemFeatureFlags',
    DefaultSystemSnapshot.featureFlags
  )
  core.registerSystemProperty(
    'systemPermissions',
    DefaultSystemSnapshot.permissions
  )

  core.registerSystemProperty('mouseDragStart', DefaultMoseSnapshot.dragStart)
  core.registerSystemProperty('mousePosition', DefaultMoseSnapshot.position)
  core.registerSystemProperty('mouseDelta', DefaultMoseSnapshot.delta)
  core.registerSystemProperty('mouseButton', DefaultMoseSnapshot.button)
  core.registerSystemProperty('mouseDown', DefaultMoseSnapshot.down)
  core.registerSystemProperty('mouseDragging', DefaultMoseSnapshot.dragging)

  core.registerSystemProperty('keyShift', DefaultKeySnapshot.shift)
  core.registerSystemProperty('keyCtrl', DefaultKeySnapshot.ctrl)
  core.registerSystemProperty('keyAlt', DefaultKeySnapshot.alt)
  core.registerSystemProperty('keyMeta', DefaultKeySnapshot.meta)

  core.registerSystemProperty(
    'hoveredElementId',
    DefaultTargetSnapshot.hoveredElementId
  )
  core.registerSystemProperty(
    'selectedElementIds',
    DefaultTargetSnapshot.selectedElementIds
  )
  core.registerSystemProperty(
    'activeElementId',
    DefaultTargetSnapshot.activeElementId
  )

  const pathEditingVectorObservable = core.registerSystemProperty<
    string | null
  >('pathEditingVectorId', null)
  core.registerSystemProperty<boolean>('pathEditingMode', false)
  core.registerSystemProperty<boolean>('pathEditingStartNewSubpath', false)

  const selectedPointObservable =
    core.registerSystemProperty<SelectedVectorPointState | null>(
      'selectedVectorPoint',
      null
    )
  core.registerSystemProperty<SelectedVectorPointState | null>(
    'hoveredVectorPoint',
    null
  )

  core.registerUIProperty<string | null>('pathEditingVectorId', {
    defaultValue: null,
    source$: pathEditingVectorObservable
  })
  core.registerUIProperty<SelectedVectorPointState | null>(
    'selectedVectorPoint',
    {
      defaultValue: null,
      source$: selectedPointObservable
    }
  )
  core.registerUIProperty<SelectedVectorSegmentState | null>(
    'selectedVectorSegment',
    {
      defaultValue: null
    }
  )
}
