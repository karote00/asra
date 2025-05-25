// ElementInteraction
export enum ElementInteraction {
  INTERACTION_SELECT_ELEMENTS = 'INTERACTION_SELECT_ELEMENTS',
  INTERACTION_MOVE_ELEMENTS = 'INTERACTION_MOVE_ELEMENTS',
  INTERACTION_DELETE_ELEMENTS = 'INTERACTION_DELETE_ELEMENTS',
  INTERACTION_CREATE_ELEMENT = 'INTERACTION_CREATE_ELEMENT'
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
  ...ElementInteraction,
  ...PrimaryToolInteraction,
  ...UndoRedoInteraction,
  ...ZoomPresetInteraction
} as const

export type InteractionActions =
  (typeof InteractionActions)[keyof typeof InteractionActions]
