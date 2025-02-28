import { sceneTreeStore, initSceneTreeDataContext } from './scene-tree'
import {
  selectionStore,
  initElementSelectionDataContext
} from './element-selection'

export const initDataContexts = () => {
  initSceneTreeDataContext()
  initElementSelectionDataContext()
}

export { sceneTreeStore, selectionStore }
