import { sceneTreeStore, initSceneTreeDataSubscribe } from './scene-tree'
import { selectionStore, initSelectionDataSubscribe } from './selection'

export const initDataContexts = () => {
  initSceneTreeDataSubscribe()
  initSelectionDataSubscribe()
}

export { sceneTreeStore, selectionStore }
