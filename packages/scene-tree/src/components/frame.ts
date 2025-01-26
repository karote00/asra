import type { FrameRawData } from '@asra/utils'
import { EntityTypes, NameTypes } from '@asra/utils'
import Group from './group'

type FrameDataType = Partial<FrameRawData>

class Frame extends Group {
  constructor() {
    super()
  }

  _init(): void {
    this._entityType = EntityTypes.FRAME
    this._nameType = NameTypes.FRAME
    super._init()
  }

  load(data: FrameDataType): void {
    super.load(data)
  }
}

export default Frame
