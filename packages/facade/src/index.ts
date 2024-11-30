type FacadeProps = {
  version: string
}

type FacadeDataType = Partial<FacadeProps>

class Facade {
  constructor(data: FacadeDataType) {
    this._init(data)
  }

  _init(data: FacadeDataType) {}
}

interface Facade extends FacadeProps {}

export default Facade
