import { FrameRawData, EntityTypes } from '@asra/utils'
import Group from './group'

type FrameDataType = Partial<FrameRawData>

class Frame extends Group {
  constructor() {
    super()
  }

  _init(): void {
    this.type = EntityTypes.FRAME
    super._init()
  }

  load(data: FrameDataType): void {
    super.load(data)
  }
}

export default Frame
