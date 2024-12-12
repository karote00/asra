import { PropsRawData } from '@asra/utils'

type PropsDataType = Partial<PropsRawData> | undefined

class Props {
  constructor(data?: PropsDataType) {
    this._init()
    this.load(data)
  }

  _init(): void {}

  load(data: PropsDataType): void {}
}

export default Props
