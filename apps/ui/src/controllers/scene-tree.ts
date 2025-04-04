import { DataTypes } from '@asra/utils'
import { sceneTreeManager } from '../contexts'

export const addRectangle = () => {
  sceneTreeManager.addRectangle()
}

export const changeElementComputedData = (key: string, data: DataTypes) => {
  sceneTreeManager.changeComputedData(key, data)
}
