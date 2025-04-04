import { DataTypes } from '@asra/utils'
import { sceneTreeManager } from '../contexts'

export const addRectangle = () => {
  sceneTreeManager.addRectangle()
}

export const changeElementData = (key: string, data: DataTypes) => {
  sceneTreeManager.changeElementData(key, data)
}
