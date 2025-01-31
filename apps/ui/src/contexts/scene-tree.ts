import { Factory } from './index'
import { collectSceneTreeChange } from '../processor/scene-tree'

let hasInit = false

export const initSceneTreeDataContext = () => {
  if (hasInit) {
    return
  }

  const sceneTreeArray = Factory.sceneTreeMap
  sceneTreeArray.observe(collectSceneTreeChange)

  hasInit = true
}
