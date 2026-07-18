import type { PropertyComponentInstanceDataTypes } from '@asyra/utils'
import type { PropertyFieldUpdate } from './props'

type Assert<T extends true> = T

interface AppDeclaredPropertyFields {
  customCount: number
  customLabel: string
}

type AppPropertyUpdate = PropertyFieldUpdate<AppDeclaredPropertyFields>
type BuiltinPropertyUpdate =
  PropertyFieldUpdate<PropertyComponentInstanceDataTypes>

type _CustomCountAcceptsNumber = Assert<
  ['customCount', number] extends AppPropertyUpdate ? true : false
>

type _CustomLabelAcceptsString = Assert<
  ['customLabel', string] extends AppPropertyUpdate ? true : false
>

type _CustomCountRejectsAnotherFieldValue = Assert<
  ['customCount', string] extends AppPropertyUpdate ? false : true
>

type _BuiltinPositionFieldRemainsAvailable = Assert<
  ['x', number] extends BuiltinPropertyUpdate ? true : false
>
