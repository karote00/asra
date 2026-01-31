export const TransactionInteraction = {
  INTERACTION_START_TRANSACTION: 'INTERACTION_START_TRANSACTION',
  INTERACTION_END_TRANSACTION: 'INTERACTION_END_TRANSACTION'
} as const

export const ElementInteraction = {
  INTERACTION_SELECT_ELEMENTS: 'INTERACTION_SELECT_ELEMENTS',
  INTERACTION_MOVE_ELEMENTS: 'INTERACTION_MOVE_ELEMENTS',
  INTERACTION_DELETE_ELEMENTS: 'INTERACTION_DELETE_ELEMENTS',
  INTERACTION_CREATE_ELEMENT: 'INTERACTION_CREATE_ELEMENT',
  INTERACTION_RESIZE_ELEMENT: 'INTERACTION_RESIZE_ELEMENT',
  INTERACTION_END_RESIZE_ELEMENT: 'INTERACTION_END_RESIZE_ELEMENT',
  INTERACTION_RESET_ELEMENT_SIZE: 'INTERACTION_RESET_ELEMENT_SIZE'
} as const

export const PrimaryToolInteraction = {
  INTERACTION_SWITCH_PRIMARY_TOOL: 'INTERACTION_SWITCH_PRIMARY_TOOL'
} as const

export const UndoRedoInteraction = {
  INTERACTION_UNDOREDO: 'INTERACTION_UNDOREDO'
} as const

export const ZoomPresetInteraction = {
  INTERACTION_ZOOM_FIT: 'INTERACTION_ZOOM_FIT',
  INTERACTION_PAN_ZOOM: 'INTERACTION_PAN_ZOOM'
} as const

export const InteractionActions = {
  ...TransactionInteraction,
  ...ElementInteraction,
  ...PrimaryToolInteraction,
  ...UndoRedoInteraction,
  ...ZoomPresetInteraction
} as const

export type InteractionEvent =
  | (typeof InteractionActions)[keyof typeof InteractionActions]
  | string
export type KnownInteractionAction =
  (typeof InteractionActions)[keyof typeof InteractionActions]
