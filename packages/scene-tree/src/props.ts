import { PropsRawData } from '@asra/utils'

type PropsDataType = Partial<PropsRawData> | undefined

class Props {
  constructor(data?: PropsDataType) {
    this._init()
    this.load(data)
  }

  _init(): void {
    // init
  }

  load(data: PropsDataType): void {
    // load data
  }
}

export default Props
