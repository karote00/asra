import { defineFeature } from '@asyra/feature-system'
import { transactionApis } from '../../common-apis'

export const transactionFeature = defineFeature('transaction', undefined, {
  api: {
    start: () => transactionApis.startTransaction(),
    end: () => transactionApis.endTransaction()
  }
})

export default transactionFeature
