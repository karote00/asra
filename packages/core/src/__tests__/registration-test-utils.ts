import { RegistrationRelationError } from '@asyra/utils'
import { expect } from 'vitest'

export const expectRelationError = (
  run: () => unknown,
  code: RegistrationRelationError['code']
) => {
  try {
    run()
    throw new Error(`Expected RegistrationRelationError ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(RegistrationRelationError)
    expect((error as RegistrationRelationError).code).toBe(code)
  }
}
