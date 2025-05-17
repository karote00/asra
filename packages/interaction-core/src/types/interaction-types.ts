export enum InteractionAction {
  SELECT_ELEMENTS = 'selectElement',
  MOVE_ELEMENTS = 'moveElements',
  DELETE_ELEMENTS = 'deleteElements',
  NONE = 'none'
}

export interface InteractionEvent {
  type: InteractionAction
  payload?: any
}
