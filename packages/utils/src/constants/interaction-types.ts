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

export const InteractionActions = {
  ...ElementInteraction,
  ...PrimaryToolInteraction
} as const

export type InteractionActions =
  (typeof InteractionActions)[keyof typeof InteractionActions]
