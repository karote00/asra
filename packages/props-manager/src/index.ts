import { PropDataType } from '@asra/utils'
import { initPropXSubscribes } from './subscribes'

initPropXSubscribes()

type PropXRawData = Record<string, PropDataType>

class PropsManager {
  constructor(data?: PropXRawData) {
    if (data) {
      this.load(data)
    }
  }

  load(data?: PropXRawData) {
    console.log(data)
  }
}

const propsManager = new PropsManager()
export default propsManager
export { PropsManager }
