export const ToolFeatureNames = {
  SWITCH_PRIMARY_TOOL: 'switchPrimaryTool'
} as const

export const ElementFeatureNames = {
  CREATE_ELEMENT: 'createElement',
  MOVE_ELEMENTS: 'moveElements',
  HOVER_ELEMENT: 'hoverElement',
  SELECTION: 'selection',
  DELETE_SELECTED_ELEMENT: 'deleteSelectedElement',
  GROUP_ELEMENTS: 'groupElements',
  MOVE_LAYER_HIERARCHY: 'moveLayerHierarchy'
} as const

export const ViewportFeatureNames = {
  PAN: 'pan',
  ZOOM: 'zoom',
  ZOOM_FIT: 'zoomFit'
} as const

export const HistoryFeatureNames = {
  UNDO_REDO: 'undoRedo'
} as const

export const VectorPathFeatureNames = {
  PEN: 'pen',
  DELETE_VECTOR_POINT: 'deleteVectorPoint',
  SELECT_VECTOR_POINT: 'selectVectorPoint',
  HOVER_VECTOR_POINT_CURSOR: 'hoverVectorPointCursor',
  CANCEL_PEN_EDITING: 'cancelPenEditing',
  ENTER_PATH_EDITING: 'enterPathEditing',
  ENTER_PATH_EDITING_BY_DOUBLE_CLICK: 'enterPathEditingByDoubleClick'
} as const

export const GradientFeatureNames = {
  HOVER_GRADIENT_HANDLE: 'hoverGradientHandle',
  DRAG_GRADIENT_HANDLE: 'dragGradientHandle',
  HOVER_GRADIENT_STOP: 'hoverGradientStop',
  DRAG_GRADIENT_STOP: 'dragGradientStop'
} as const

type AssertNoOverlap<A, B> =
  Extract<keyof A, keyof B> extends never
    ? true
    : ['Duplicate feature key detected', Extract<keyof A, keyof B>]

type EnsureTrue<T extends true> = T

type _ToolVsElement = EnsureTrue<
  AssertNoOverlap<typeof ToolFeatureNames, typeof ElementFeatureNames>
>
type _ToolVsViewport = EnsureTrue<
  AssertNoOverlap<typeof ToolFeatureNames, typeof ViewportFeatureNames>
>
type _ToolVsHistory = EnsureTrue<
  AssertNoOverlap<typeof ToolFeatureNames, typeof HistoryFeatureNames>
>
type _ToolVsVectorPath = EnsureTrue<
  AssertNoOverlap<typeof ToolFeatureNames, typeof VectorPathFeatureNames>
>
type _ElementVsViewport = EnsureTrue<
  AssertNoOverlap<typeof ElementFeatureNames, typeof ViewportFeatureNames>
>
type _ElementVsHistory = EnsureTrue<
  AssertNoOverlap<typeof ElementFeatureNames, typeof HistoryFeatureNames>
>
type _ElementVsVectorPath = EnsureTrue<
  AssertNoOverlap<typeof ElementFeatureNames, typeof VectorPathFeatureNames>
>
type _ViewportVsHistory = EnsureTrue<
  AssertNoOverlap<typeof ViewportFeatureNames, typeof HistoryFeatureNames>
>
type _ViewportVsVectorPath = EnsureTrue<
  AssertNoOverlap<typeof ViewportFeatureNames, typeof VectorPathFeatureNames>
>
type _HistoryVsVectorPath = EnsureTrue<
  AssertNoOverlap<typeof HistoryFeatureNames, typeof VectorPathFeatureNames>
>
type _ToolVsGradient = EnsureTrue<
  AssertNoOverlap<typeof ToolFeatureNames, typeof GradientFeatureNames>
>
type _ElementVsGradient = EnsureTrue<
  AssertNoOverlap<typeof ElementFeatureNames, typeof GradientFeatureNames>
>
type _ViewportVsGradient = EnsureTrue<
  AssertNoOverlap<typeof ViewportFeatureNames, typeof GradientFeatureNames>
>
type _HistoryVsGradient = EnsureTrue<
  AssertNoOverlap<typeof HistoryFeatureNames, typeof GradientFeatureNames>
>
type _VectorPathVsGradient = EnsureTrue<
  AssertNoOverlap<typeof VectorPathFeatureNames, typeof GradientFeatureNames>
>

export type FeatureNameOverlapChecks = [
  _ToolVsElement,
  _ToolVsViewport,
  _ToolVsHistory,
  _ToolVsVectorPath,
  _ElementVsViewport,
  _ElementVsHistory,
  _ElementVsVectorPath,
  _ViewportVsHistory,
  _ViewportVsVectorPath,
  _HistoryVsVectorPath,
  _ToolVsGradient,
  _ElementVsGradient,
  _ViewportVsGradient,
  _HistoryVsGradient,
  _VectorPathVsGradient
]

export const FeatureNames = {
  ...ToolFeatureNames,
  ...ElementFeatureNames,
  ...ViewportFeatureNames,
  ...HistoryFeatureNames,
  ...VectorPathFeatureNames,
  ...GradientFeatureNames
} as const

export type FeatureName = (typeof FeatureNames)[keyof typeof FeatureNames]
