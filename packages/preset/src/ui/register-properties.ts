import { SCENE_TREE_ACTIONS } from '@asyra/utils'
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

  const zoomObservable = core.registerSystemProperty<number>('zoom', 1, {
    silent: true,
    runtime: true
  })
  core.registerUIProperty<number>('zoom', {
    defaultValue: 1,
    source$: zoomObservable
  })

  const primaryToolObservable = core.registerSystemProperty<string>(
    'primaryTool',
    DEFAULT_PRIMARY_TOOL,
    {
      silent: true,
      runtime: true
    }
  )
  core.registerUIProperty<string>('primaryTool', {
    defaultValue: DEFAULT_PRIMARY_TOOL,
    source$: primaryToolObservable
  })

  const pathEditingVectorObservable = core.registerSystemProperty<
    string | null
  >('pathEditingVectorId', null, {
    silent: true,
    runtime: true
  })
  core.registerSystemProperty<boolean>('pathEditingMode', false, {
    silent: true,
    runtime: true
  })
  core.registerSystemProperty<boolean>('pathEditingStartNewSubpath', false, {
    silent: true,
    runtime: true
  })

  const selectedPointObservable =
    core.registerSystemProperty<SelectedVectorPointState | null>(
      'selectedVectorPoint',
      null,
      {
        silent: true,
        runtime: true
      }
    )
  core.registerSystemProperty<SelectedVectorPointState | null>(
    'hoveredVectorPoint',
    null,
    {
      silent: true,
      runtime: true
    }
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
