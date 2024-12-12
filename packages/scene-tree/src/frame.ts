import { FrameRawData } from '@asra/utils'
import Group from './group'

type FrameDataType = Partial<FrameRawData>

class Frame extends Group {
  constructor() {
    super()

    this._init()
  }

  _init(): void {}

  load(data: FrameDataType): void {
    super.load(data)
  }
}

export default Frame
