// Transaction
export enum TransactionInteraction {
  INTERACTION_START_TRANSACTION = 'INTERACTION_START_TRANSACTION',
  INTERACTION_END_TRANSACTION = 'INTERACTION_END_TRANSACTION'
}

// ElementInteraction
export enum ElementInteraction {
  INTERACTION_SELECT_ELEMENTS = 'INTERACTION_SELECT_ELEMENTS',
  INTERACTION_MOVE_ELEMENTS = 'INTERACTION_MOVE_ELEMENTS',
  INTERACTION_DELETE_ELEMENTS = 'INTERACTION_DELETE_ELEMENTS',
  INTERACTION_CREATE_ELEMENT = 'INTERACTION_CREATE_ELEMENT',
  INTERACTION_RESIZE_ELEMENT = 'INTERACTION_RESIZE_ELEMENT',
  INTERACTION_END_RESIZE_ELEMENT = 'INTERACTION_END_RESIZE_ELEMENT',
  INTERACTION_RESET_ELEMENT_SIZE = 'INTERACTION_RESET_ELEMENT_SIZE'
}

// PrimaryToolInteraction
export enum PrimaryToolInteraction {
  INTERACTION_SWITCH_PRIMARY_TOOL = 'INTERACTION_SWITCH_PRIMARY_TOOL'
}

// UndoRedoInteraction
export enum UndoRedoInteraction {
  INTERACTION_UNDOREDO = 'INTERACTION_UNDOREDO'
}

// ZoomPreset
export enum ZoomPresetInteraction {
  INTERACTION_ZOOM_FIT = 'INTERACTION_ZOOM_FIT',
  INTERACTION_PAN_ZOOM = 'INTERACTION_PAN_ZOOM'
}

export const InteractionActions = {
  ...TransactionInteraction,
  ...ElementInteraction,
  ...PrimaryToolInteraction,
  ...UndoRedoInteraction,
  ...ZoomPresetInteraction
} as const

export type InteractionActions =
  (typeof InteractionActions)[keyof typeof InteractionActions]
