import type {
  RegistrationDefinitionMetadata,
  RegistrationOwnerMetadata,
  RegistrationRelationDeclaration
} from '@asyra/utils'

export const PRESET_REGISTRATION_OWNER: RegistrationOwnerMetadata =
  Object.freeze({
    packageName: '@asyra/preset',
    name: 'default-preset'
  })

export const createPresetRegistration = (
  relations: readonly RegistrationRelationDeclaration[] = []
): RegistrationDefinitionMetadata => ({
  owner: PRESET_REGISTRATION_OWNER,
  relations
})

export const PRESET_REGISTRATION = createPresetRegistration()

export const createPresetPropertyDependencies = (
  propertyTypes: readonly string[]
): readonly RegistrationRelationDeclaration[] =>
  [...new Set(propertyTypes)].map((propertyType) => ({
    name: `property:${propertyType}`,
    target: { kind: 'property', key: propertyType },
    onTargetUnregister: 'unregister-source'
  }))
