import {
  RegistrationRelationError,
  type RegistrationContractErrorCode,
  type RegistrationGraphOperation
} from '@asyra/utils'

export const failRegistrationRelation = (
  code: RegistrationContractErrorCode,
  operation: RegistrationGraphOperation,
  message: string,
  details: Partial<RegistrationRelationError['result']> = {}
): never => {
  throw new RegistrationRelationError({
    ok: false,
    code,
    operation,
    message,
    ...details
  })
}
