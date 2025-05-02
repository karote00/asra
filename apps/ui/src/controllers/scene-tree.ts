import { DataTypes } from '@asra/utils'
import core from '../contexts'

export const changeElementComputedData = (key: string, data: DataTypes) => {
  core.changeComputedData(key, data)
}
