import sceneTree from '@asyra/scene-tree'
import SceneTreeStore from './scene-tree'
import SelectionStore from './selection'

export const uiContextSceneTreeStore = new SceneTreeStore(sceneTree)
export const uiContextSelectionStore = new SelectionStore()
