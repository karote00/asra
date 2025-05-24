// ElementInteraction
export enum ElementInteraction {
  SELECT_ELEMENTS = 'selectElement',
  MOVE_ELEMENTS = 'moveElements',
  DELETE_ELEMENTS = 'deleteElements',
  CREATE_ELEMENT = 'createElement'
}

// NoneInteraction
export enum NoneInteraction {
  NONE = 'none'
}

export const InteractionAction = {
  ...NoneInteraction,
  ...ElementInteraction
}

export type InteractionAction =
  (typeof InteractionAction)[keyof typeof InteractionAction]
