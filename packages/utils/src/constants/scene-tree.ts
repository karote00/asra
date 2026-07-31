export enum SCENE_TREE_ACTIONS {
  ADD_ELEMENT = 'addElement',
  ADD_ELEMENTS = 'addElements',
  REMOVE_ELEMENT = 'removeElement',
  REMOVE_ELEMENTS = 'removeElements',
  MOVE_ELEMENTS = 'moveElements',
  REMOVE_SUBTREE = 'removeSubtree',
  RESTORE_SUBTREE = 'restoreSubtree',
  UPDATE_ELEMENT_DATA = 'updateElementData',
  UPDATE_ELEMENT_COMPUTED_DATA = 'updateElementComputedData',
  UPDATE_ELEMENT_COMPUTED_DATA_BATCH = 'updateElementComputedDataBatch',
  UPDATE_ELEMENT_COMPUTED_DATA_PATCH = 'updateElementComputedDataPatch'
}

export const DEFAULT_ELEMENT_SIZE = 100
