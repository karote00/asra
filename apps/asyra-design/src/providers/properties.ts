import { useProperty } from '../hooks'
import { MIXED_STRING } from '@asyra/utils'

type MixedNumber = number | typeof MIXED_STRING

export const useX = (): MixedNumber => useProperty<MixedNumber>('x')
export const useY = (): MixedNumber => useProperty<MixedNumber>('y')
export const useWidth = (): MixedNumber => useProperty<MixedNumber>('width')
export const useHeight = (): MixedNumber => useProperty<MixedNumber>('height')
export const useRotation = (): MixedNumber =>
  useProperty<MixedNumber>('rotation')
