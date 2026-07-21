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
import { PresetSystemPropertyKeys } from '../system-property-keys'

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

const createDefineUIProperty = (core: PresetCoreAPIs) => {
  const propertyDependencies: Readonly<Record<string, readonly string[]>> = {
    x: [PropertyTypes.POSITION],
    y: [PropertyTypes.POSITION],
    width: [PropertyTypes.DIMENSION],
    height: [PropertyTypes.DIMENSION],
    fills: [PropertyTypes.FILLS],
    strokes: [PropertyTypes.STROKES]
  }
  return <T extends PropertyValue>(
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
}

export const registerUIContextProperties = (core: PresetCoreAPIs): void => {
  const defineUIProperty = createDefineUIProperty(core)

  defineUIProperty<Set<string>>('elementSelection', {
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

  defineUIProperty<string | null>(PresetSystemPropertyKeys.HOVERED_ELEMENT_ID, {
    defaultValue: null,
    source$: core.getSystemPropertyObservable(
      PresetSystemPropertyKeys.HOVERED_ELEMENT_ID
    )
  })
}

export const registerViewportProperties = (core: PresetCoreAPIs): void => {
  const defineUIProperty = createDefineUIProperty(core)

  const zoomObservable = core.defineSystemProperty<number>(
    PresetSystemPropertyKeys.ZOOM,
    1
  )
  defineUIProperty<number>(PresetSystemPropertyKeys.ZOOM, {
    defaultValue: 1,
    source$: zoomObservable
  })
}

export const registerInputProperties = (core: PresetCoreAPIs): void => {
  const defineUIProperty = createDefineUIProperty(core)

  const primaryToolObservable = core.defineSystemProperty<string>(
    PresetSystemPropertyKeys.PRIMARY_TOOL,
    DEFAULT_PRIMARY_TOOL
  )
  defineUIProperty<string>(PresetSystemPropertyKeys.PRIMARY_TOOL, {
    defaultValue: DEFAULT_PRIMARY_TOOL,
    source$: primaryToolObservable
  })

  core.defineSystemProperty(
    PresetSystemPropertyKeys.SYSTEM_MODE,
    DefaultSystemSnapshot.mode
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.SYSTEM_FEATURE_FLAGS,
    DefaultSystemSnapshot.featureFlags
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.SYSTEM_PERMISSIONS,
    DefaultSystemSnapshot.permissions
  )

  core.defineSystemProperty(
    PresetSystemPropertyKeys.MOUSE_DRAG_START,
    DefaultMoseSnapshot.dragStart
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.MOUSE_POSITION,
    DefaultMoseSnapshot.position
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.MOUSE_DELTA,
    DefaultMoseSnapshot.delta
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.MOUSE_BUTTON,
    DefaultMoseSnapshot.button
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.MOUSE_DOWN,
    DefaultMoseSnapshot.down
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.MOUSE_DRAGGING,
    DefaultMoseSnapshot.dragging
  )

  core.defineSystemProperty(
    PresetSystemPropertyKeys.KEY_SHIFT,
    DefaultKeySnapshot.shift
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.KEY_CTRL,
    DefaultKeySnapshot.ctrl
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.KEY_ALT,
    DefaultKeySnapshot.alt
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.KEY_META,
    DefaultKeySnapshot.meta
  )
}

export const registerSelectionProperties = (core: PresetCoreAPIs): void => {
  core.defineSystemProperty(
    PresetSystemPropertyKeys.HOVERED_ELEMENT_ID,
    DefaultTargetSnapshot.hoveredElementId
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.SELECTED_ELEMENT_IDS,
    DefaultTargetSnapshot.selectedElementIds
  )
  core.defineSystemProperty(
    PresetSystemPropertyKeys.ACTIVE_ELEMENT_ID,
    DefaultTargetSnapshot.activeElementId
  )
}

export const registerVectorEditingProperties = (core: PresetCoreAPIs): void => {
  const defineUIProperty = createDefineUIProperty(core)

  defineUIProperty<Set<string>>('vectorPointSelection', {
    defaultValue: new Set()
  })

  defineUIProperty<Set<string>>('vectorSegmentSelection', {
    defaultValue: new Set()
  })

  const pathEditingVectorObservable = core.defineSystemProperty<string | null>(
    PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID,
    null
  )
  core.defineSystemProperty<boolean>(
    PresetSystemPropertyKeys.PATH_EDITING_MODE,
    false
  )
  core.defineSystemProperty<boolean>(
    PresetSystemPropertyKeys.PATH_EDITING_START_NEW_SUBPATH,
    false
  )

  const selectedPointObservable =
    core.defineSystemProperty<SelectedVectorPointState | null>(
      PresetSystemPropertyKeys.SELECTED_VECTOR_POINT,
      null
    )
  core.defineSystemProperty<SelectedVectorPointState | null>(
    PresetSystemPropertyKeys.HOVERED_VECTOR_POINT,
    null
  )
  core.defineSystemProperty<SelectedVectorSegmentState | null>(
    PresetSystemPropertyKeys.SELECTED_VECTOR_SEGMENT,
    null
  )
  core.defineSystemProperty<SelectedVectorSegmentState | null>(
    PresetSystemPropertyKeys.HOVERED_VECTOR_SEGMENT,
    null
  )
  core.defineSystemProperty<HoveredVectorSegmentInsertPointState | null>(
    PresetSystemPropertyKeys.HOVERED_VECTOR_SEGMENT_INSERT_POINT,
    null
  )

  const pathEditingContinuationObservable =
    core.defineSystemProperty<PathEditingContinuationState | null>(
      PresetSystemPropertyKeys.PATH_EDITING_CONTINUATION,
      null
    )

  defineUIProperty<string | null>(
    PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID,
    {
      defaultValue: null,
      source$: pathEditingVectorObservable
    }
  )
  defineUIProperty<SelectedVectorPointState | null>(
    PresetSystemPropertyKeys.SELECTED_VECTOR_POINT,
    {
      defaultValue: null,
      source$: selectedPointObservable
    }
  )
  defineUIProperty<SelectedVectorSegmentState | null>(
    PresetSystemPropertyKeys.SELECTED_VECTOR_SEGMENT,
    {
      defaultValue: null
    }
  )

  defineUIProperty<PathEditingContinuationState | null>(
    PresetSystemPropertyKeys.PATH_EDITING_CONTINUATION,
    {
      defaultValue: null,
      source$: pathEditingContinuationObservable
    }
  )
}

export const registerProperties = (core: PresetCoreAPIs): void => {
  registerInputProperties(core)
  registerSelectionProperties(core)
  registerVectorEditingProperties(core)
  registerViewportProperties(core)
  registerUIContextProperties(core)
}
