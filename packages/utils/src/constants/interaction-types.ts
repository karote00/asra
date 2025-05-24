// NoneInteraction
export enum NoneInteraction {
  ACTION_NONE = 'ACTION_NONE'
}

// ElementInteraction
export enum ElementInteraction {
  ACTION_SELECT_ELEMENTS = 'ACTION_SELECT_ELEMENTS',
  ACTION_MOVE_ELEMENTS = 'ACTION_MOVE_ELEMENTS',
  ACTION_DELETE_ELEMENTS = 'ACTION_DELETE_ELEMENTS',
  ACTION_CREATE_ELEMENT = 'ACTION_CREATE_ELEMENT'
}

// PrimaryToolInteraction
export enum PrimaryToolInteraction {
  ACTION_SWITCH_PRIMARY_TOOL_TO_SELECT = 'ACTION_SWITCH_PRIMARY_TOOL_TO_SELECT',
  ACTION_SWITCH_PRIMARY_TOOL_TO_RECTANGLE = 'ACTION_SWITCH_PRIMARY_TOOL_TO_RECTANGLE'
}

export const InteractionAction = {
  ...NoneInteraction,
  ...ElementInteraction,
  ...PrimaryToolInteraction
}

export type InteractionAction =
  (typeof InteractionAction)[keyof typeof InteractionAction]
