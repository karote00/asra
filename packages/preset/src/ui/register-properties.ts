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
  core.defineUIProperty<Set<string>>('elementSelection', {
    defaultValue: new Set()
  })

  core.defineUIProperty<Set<string>>('vectorPointSelection', {
    defaultValue: new Set()
  })

  core.defineUIProperty<Set<string>>('vectorSegmentSelection', {
    defaultValue: new Set()
  })

  core.defineUIProperty<string[]>('flattenedElementIds', {
    defaultValue: []
  })

  core.defineUIProperty<Record<string, ElementPanelData>>('elementDataMap', {
    defaultValue: {}
  })

  core.defineUIProperty<number | string>('x', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'x',
      onSelectionChange: true
    }
  })

  core.defineUIProperty<number | string>('y', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'y',
      onSelectionChange: true
    }
  })

  core.defineUIProperty<number | string>('width', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'width',
      onSelectionChange: true
    }
  })

  core.defineUIProperty<number | string>('height', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'height',
      onSelectionChange: true
    }
  })

  core.defineUIProperty<number | string>('rotation', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'rotation',
      onSelectionChange: true
    }
  })

  const zoomObservable = core.defineSystemProperty<number>('zoom', 1)
  core.defineUIProperty<number>('zoom', {
    defaultValue: 1,
    source$: zoomObservable
  })

  const primaryToolObservable = core.defineSystemProperty<string>(
    'primaryTool',
    DEFAULT_PRIMARY_TOOL
  )
  core.defineUIProperty<string>('primaryTool', {
    defaultValue: DEFAULT_PRIMARY_TOOL,
    source$: primaryToolObservable
  })

  core.defineSystemProperty('systemMode', DefaultSystemSnapshot.mode)
  core.defineSystemProperty(
    'systemFeatureFlags',
    DefaultSystemSnapshot.featureFlags
  )
  core.defineSystemProperty(
    'systemPermissions',
    DefaultSystemSnapshot.permissions
  )

  core.defineSystemProperty('mouseDragStart', DefaultMoseSnapshot.dragStart)
  core.defineSystemProperty('mousePosition', DefaultMoseSnapshot.position)
  core.defineSystemProperty('mouseDelta', DefaultMoseSnapshot.delta)
  core.defineSystemProperty('mouseButton', DefaultMoseSnapshot.button)
  core.defineSystemProperty('mouseDown', DefaultMoseSnapshot.down)
  core.defineSystemProperty('mouseDragging', DefaultMoseSnapshot.dragging)

  core.defineSystemProperty('keyShift', DefaultKeySnapshot.shift)
  core.defineSystemProperty('keyCtrl', DefaultKeySnapshot.ctrl)
  core.defineSystemProperty('keyAlt', DefaultKeySnapshot.alt)
  core.defineSystemProperty('keyMeta', DefaultKeySnapshot.meta)

  const hoveredElementObservable = core.defineSystemProperty(
    'hoveredElementId',
    DefaultTargetSnapshot.hoveredElementId
  )
  core.defineSystemProperty(
    'selectedElementIds',
    DefaultTargetSnapshot.selectedElementIds
  )
  core.defineSystemProperty(
    'activeElementId',
    DefaultTargetSnapshot.activeElementId
  )

  const pathEditingVectorObservable = core.defineSystemProperty<string | null>(
    'pathEditingVectorId',
    null
  )
  core.defineSystemProperty<boolean>('pathEditingMode', false)
  core.defineSystemProperty<boolean>('pathEditingStartNewSubpath', false)

  const selectedPointObservable =
    core.defineSystemProperty<SelectedVectorPointState | null>(
      'selectedVectorPoint',
      null
    )
  core.defineSystemProperty<SelectedVectorPointState | null>(
      'hoveredVectorPoint',
      null
  )
  core.defineSystemProperty<SelectedVectorSegmentState | null>(
    'selectedVectorSegment',
    null
  )
  core.defineSystemProperty<SelectedVectorSegmentState | null>(
    'hoveredVectorSegment',
    null
  )

  core.defineUIProperty<string | null>('pathEditingVectorId', {
    defaultValue: null,
    source$: pathEditingVectorObservable
  })
  core.defineUIProperty<string | null>('hoveredElementId', {
    defaultValue: null,
    source$: hoveredElementObservable
  })
  core.defineUIProperty<SelectedVectorPointState | null>(
    'selectedVectorPoint',
    {
      defaultValue: null,
      source$: selectedPointObservable
    }
  )
  core.defineUIProperty<SelectedVectorSegmentState | null>(
    'selectedVectorSegment',
    {
      defaultValue: null
    }
  )
}
