import {
  SCENE_TREE_ACTIONS,
  DefaultMoseSnapshot,
  DefaultSystemSnapshot,
  DefaultTargetSnapshot,
  DefaultKeySnapshot,
  MIXED_STRING,
  PropertyTypes,
  createDefaultFill,
  createDefaultStroke,
  type FillAttrs,
  type FillRowAttrs,
  type StrokeAttrs,
  type StrokeRowAttrs
} from '@asyra/utils'
import {
  type SelectedVectorPointState,
  type VectorEditingContinuation,
  type SelectedVectorSegmentState,
  type HoveredVectorSegmentInsertPointState
} from '@asyra/core'
import type {
  PropertyComputeContext,
  PropertyRegistration,
  PropertyValue
} from '@asyra/ui-context'
import type { PresetCoreAPIs } from '../types'
import {
  createPresetPropertyDependencies,
  createPresetRegistration
} from '../registration'

const DEFAULT_PRIMARY_TOOL = 'select'

export interface PathEditingContinuationState
  extends VectorEditingContinuation,
    Record<string, unknown> {
  elementId: string
}

interface ElementPanelData extends Record<string, unknown> {
  id: string
  name: string
  type: string
  lock: boolean
  visible: boolean
}

const isFillArray = (value: unknown): value is FillAttrs[] =>
  Array.isArray(value)

const toFillRows = (fills: FillAttrs[]): FillRowAttrs[] =>
  fills.reduce<FillRowAttrs[]>((rows, fill) => {
    if (typeof fill?.id !== 'string' || fill.id.length === 0) {
      return rows
    }

    rows.push({
      ...createDefaultFill(),
      ...fill,
      ids: [fill.id]
    })

    return rows
  }, [])

const toStrokeRows = (strokes: StrokeAttrs[]): StrokeRowAttrs[] =>
  strokes.reduce<StrokeRowAttrs[]>((rows, stroke) => {
    if (typeof stroke?.id !== 'string' || stroke.id.length === 0) {
      return rows
    }

    rows.push({
      ...createDefaultStroke(stroke),
      ids: [stroke.id]
    })

    return rows
  }, [])

const areGradientStopsEqual = (
  a: NonNullable<FillAttrs['gradient']>['gradientStops'],
  b: NonNullable<FillAttrs['gradient']>['gradientStops']
) => {
  if (a.length !== b.length) {
    return false
  }

  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].position !== b[i].position ||
      a[i].color !== b[i].color ||
      a[i].opacity !== b[i].opacity
    ) {
      return false
    }
  }

  return true
}

const areGradientHandlesEqual = (
  a: NonNullable<FillAttrs['gradient']>['gradientHandles'],
  b: NonNullable<FillAttrs['gradient']>['gradientHandles']
) => {
  if (a.length !== b.length) {
    return false
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) {
      return false
    }
  }

  return true
}

const areGradientsEqual = (
  a: FillAttrs['gradient'],
  b: FillAttrs['gradient']
) => {
  if (!a || !b) {
    return false
  }

  if (a.gradientType !== b.gradientType) {
    return false
  }

  return (
    areGradientStopsEqual(a.gradientStops, b.gradientStops) &&
    areGradientHandlesEqual(a.gradientHandles, b.gradientHandles)
  )
}

const areFillsEqual = (a: FillAttrs, b: FillAttrs) => {
  if (a.kind !== b.kind) {
    return false
  }

  if (a.color !== b.color || a.opacity !== b.opacity) {
    return false
  }

  if (a.kind === 'gradient') {
    return areGradientsEqual(a.gradient, b.gradient)
  }

  return true
}

const areStrokeFillPayloadsEqual = (
  a: StrokeAttrs['fill'],
  b: StrokeAttrs['fill']
) => {
  if (!a && !b) {
    return true
  }

  if (!a || !b) {
    return false
  }

  return (
    a.defaultColorFormat === b.defaultColorFormat &&
    a.colorFormat === b.colorFormat &&
    a.visible === b.visible &&
    areFillsEqual(a, b)
  )
}

const isStrokeArray = (value: unknown): value is StrokeAttrs[] =>
  Array.isArray(value)

const areStrokesEqual = (a: StrokeAttrs, b: StrokeAttrs) =>
  a.style === b.style &&
  a.position === b.position &&
  a.width === b.width &&
  a.dash === b.dash &&
  a.gap === b.gap &&
  areStrokeFillPayloadsEqual(a.fill, b.fill) &&
  a.joinType === b.joinType &&
  a.miterAngle === b.miterAngle &&
  a.capType === b.capType

const computeFillsValue = ({
  selectedIds,
  elements
}: PropertyComputeContext): FillRowAttrs[] | typeof MIXED_STRING => {
  if (selectedIds.size === 0) {
    return []
  }

  const elementFills = elements.map((element) => {
    const fills = (element as unknown as Record<string, unknown> | undefined)
      ?.fills
    return isFillArray(fills) ? fills : []
  })

  if (elementFills.length === 0) {
    return []
  }

  const baseFills = elementFills[0]

  if (!elementFills.every((fills) => fills.length === baseFills.length)) {
    return MIXED_STRING
  }

  for (let i = 0; i < baseFills.length; i += 1) {
    const baseFill = baseFills[i]
    const allMatch = elementFills.every((fills) =>
      areFillsEqual(baseFill, fills[i])
    )

    if (!allMatch) {
      return MIXED_STRING
    }
  }

  return toFillRows(baseFills)
}

const computeStrokesValue = ({
  selectedIds,
  elements
}: PropertyComputeContext): StrokeRowAttrs[] | typeof MIXED_STRING => {
  if (selectedIds.size === 0) {
    return []
  }

  const elementStrokes = elements.map((element) => {
    const strokes = (element as unknown as Record<string, unknown> | undefined)
      ?.strokes
    return isStrokeArray(strokes) ? strokes : []
  })

  if (elementStrokes.length === 0) {
    return []
  }

  const baseStrokes = elementStrokes[0]

  if (
    !elementStrokes.every((strokes) => strokes.length === baseStrokes.length)
  ) {
    return MIXED_STRING
  }

  for (let i = 0; i < baseStrokes.length; i += 1) {
    const baseStroke = baseStrokes[i]
    const allMatch = elementStrokes.every((strokes) =>
      areStrokesEqual(baseStroke, strokes[i])
    )

    if (!allMatch) {
      return MIXED_STRING
    }
  }

  return toStrokeRows(baseStrokes)
}

export const registerProperties = (core: PresetCoreAPIs): void => {
  const propertyDependencies: Readonly<Record<string, readonly string[]>> = {
    x: [PropertyTypes.POSITION],
    y: [PropertyTypes.POSITION],
    width: [PropertyTypes.DIMENSION],
    height: [PropertyTypes.DIMENSION],
    fills: [PropertyTypes.FILLS],
    strokes: [PropertyTypes.STROKES]
  }
  const defineUIProperty = <T extends PropertyValue>(
    key: string,
    config: PropertyRegistration<T>
  ): void => {
    core.defineUIProperty<T>(key, {
      ...config,
      registration: createPresetRegistration(
        createPresetPropertyDependencies(propertyDependencies[key] ?? [])
      )
    })
  }

  defineUIProperty<Set<string>>('elementSelection', {
    defaultValue: new Set()
  })

  defineUIProperty<Set<string>>('vectorPointSelection', {
    defaultValue: new Set()
  })

  defineUIProperty<Set<string>>('vectorSegmentSelection', {
    defaultValue: new Set()
  })

  defineUIProperty<string[]>('flattenedElementIds', {
    defaultValue: []
  })

  defineUIProperty<Record<string, ElementPanelData>>('elementDataMap', {
    defaultValue: {}
  })

  defineUIProperty<number | string>('x', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'x',
      onSelectionChange: true
    }
  })

  defineUIProperty<number | string>('y', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'y',
      onSelectionChange: true
    }
  })

  defineUIProperty<number | string>('width', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'width',
      onSelectionChange: true
    }
  })

  defineUIProperty<number | string>('height', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'height',
      onSelectionChange: true
    }
  })

  defineUIProperty<number | string>('rotation', {
    defaultValue: 0,
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'rotation',
      onSelectionChange: true
    }
  })

  defineUIProperty<FillRowAttrs[] | typeof MIXED_STRING>('fills', {
    defaultValue: [],
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'fills',
      onSelectionChange: true
    },
    emptyValue: [],
    compute: computeFillsValue
  })

  defineUIProperty<StrokeRowAttrs[] | typeof MIXED_STRING>('strokes', {
    defaultValue: [],
    aggregate: true,
    triggers: {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
      key: 'strokes',
      onSelectionChange: true
    },
    emptyValue: [],
    compute: computeStrokesValue
  })

  const zoomObservable = core.defineSystemProperty<number>('zoom', 1)
  defineUIProperty<number>('zoom', {
    defaultValue: 1,
    source$: zoomObservable
  })

  const primaryToolObservable = core.defineSystemProperty<string>(
    'primaryTool',
    DEFAULT_PRIMARY_TOOL
  )
  defineUIProperty<string>('primaryTool', {
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
  core.defineSystemProperty<HoveredVectorSegmentInsertPointState | null>(
    'hoveredVectorSegmentInsertPoint',
    null
  )

  const pathEditingContinuationObservable =
    core.defineSystemProperty<PathEditingContinuationState | null>(
      'pathEditingContinuation',
      null
    )

  defineUIProperty<string | null>('pathEditingVectorId', {
    defaultValue: null,
    source$: pathEditingVectorObservable
  })
  defineUIProperty<string | null>('hoveredElementId', {
    defaultValue: null,
    source$: hoveredElementObservable
  })
  defineUIProperty<SelectedVectorPointState | null>('selectedVectorPoint', {
    defaultValue: null,
    source$: selectedPointObservable
  })
  defineUIProperty<SelectedVectorSegmentState | null>('selectedVectorSegment', {
    defaultValue: null
  })

  defineUIProperty<PathEditingContinuationState | null>(
    'pathEditingContinuation',
    {
      defaultValue: null,
      source$: pathEditingContinuationObservable
    }
  )
}
