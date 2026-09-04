import { hasExactOwnKeys, isPlainRecord } from '../domain/records'
import { validIdentifier } from '../domain/workcell'
import { EXPERIMENT_RESOURCE_PROFILE } from '../analysis/contracts'
import {
  METHOD_CATALOG_LIMITS,
  type InstalledMethodDescriptor,
  type MethodParameterSchema
} from './contracts'

const text = (
  value: unknown,
  max: number = METHOD_CATALOG_LIMITS.text
): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= max &&
  [...value].every(
    (character) =>
      character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127
  )

export function validParameterValues(
  schema: MethodParameterSchema,
  input: unknown
): boolean {
  if (!hasExactOwnKeys(input, Object.keys(schema))) return false
  return Object.entries(schema).every(([key, field]) => {
    const value = input[key]
    if (field.kind === 'boolean') return typeof value === 'boolean'
    if (field.kind === 'enum')
      return typeof value === 'string' && field.values.includes(value)
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= field.min &&
      value <= field.max
    )
  })
}

export function defaultMethodParameters(
  schema: MethodParameterSchema
): Record<string, number | string | boolean> {
  return Object.fromEntries(
    Object.entries(schema).map(([key, field]) => [key, field.default])
  )
}

function validateParameterSchema(
  input: unknown
): asserts input is MethodParameterSchema {
  if (
    !isPlainRecord(input) ||
    Object.keys(input).length > METHOD_CATALOG_LIMITS.parameters
  )
    throw new Error('Invalid method parameter schema')
  for (const [key, field] of Object.entries(input)) {
    if (
      !validIdentifier(key) ||
      ['__proto__', 'constructor', 'prototype'].includes(key) ||
      !isPlainRecord(field) ||
      !text(field.label, 100)
    )
      throw new Error('Invalid method parameter declaration')
    if (field.kind === 'number') {
      if (
        !hasExactOwnKeys(field, [
          'kind',
          'label',
          'unit',
          'min',
          'max',
          'default'
        ]) ||
        !text(field.unit, 40) ||
        typeof field.min !== 'number' ||
        !Number.isFinite(field.min) ||
        typeof field.max !== 'number' ||
        !Number.isFinite(field.max) ||
        field.min > field.max
      )
        throw new Error('Invalid numeric method parameter')
    } else if (field.kind === 'boolean') {
      if (!hasExactOwnKeys(field, ['kind', 'label', 'default']))
        throw new Error('Invalid boolean method parameter')
    } else if (field.kind === 'enum') {
      if (
        !hasExactOwnKeys(field, ['kind', 'label', 'values', 'default']) ||
        !Array.isArray(field.values) ||
        field.values.length < 1 ||
        field.values.length > 32 ||
        !field.values.every((value) =>
          text(value, METHOD_CATALOG_LIMITS.scalarText)
        ) ||
        new Set(field.values).size !== field.values.length
      )
        throw new Error('Invalid enum method parameter')
    } else throw new Error('Unsupported method parameter kind')
  }
  const schema = input as MethodParameterSchema
  if (!validParameterValues(schema, defaultMethodParameters(schema)))
    throw new Error('Invalid method parameter default')
}

export function validateInstalledDescriptor(
  input: unknown
): asserts input is InstalledMethodDescriptor {
  const optionalWarning =
    isPlainRecord(input) && Object.hasOwn(input, 'warningWorkUnits')
      ? ['warningWorkUnits']
      : []
  if (
    !hasExactOwnKeys(input, [
      'id',
      'version',
      'geometryKinds',
      'supportsStatic',
      'supportsMotion',
      'maxPairs',
      'manifest',
      'parameterSchema',
      ...optionalWarning
    ]) ||
    !validIdentifier(input.id) ||
    !text(input.version, 96) ||
    !Array.isArray(input.geometryKinds) ||
    !input.geometryKinds.length ||
    input.geometryKinds.length > 3 ||
    !input.geometryKinds.every((kind) =>
      ['box', 'sphere', 'capsule'].includes(kind)
    ) ||
    new Set(input.geometryKinds).size !== input.geometryKinds.length ||
    typeof input.supportsStatic !== 'boolean' ||
    typeof input.supportsMotion !== 'boolean' ||
    (!input.supportsStatic && !input.supportsMotion) ||
    !Number.isInteger(input.maxPairs) ||
    (input.maxPairs as number) < 1 ||
    (input.maxPairs as number) > EXPERIMENT_RESOURCE_PROFILE.maxPairs ||
    (optionalWarning.length &&
      (!Number.isInteger(input.warningWorkUnits) ||
        (input.warningWorkUnits as number) < 1 ||
        (input.warningWorkUnits as number) >
          EXPERIMENT_RESOURCE_PROFILE.maxWorkUnits))
  )
    throw new Error('Invalid installed method descriptor')
  const manifest = input.manifest
  if (
    !hasExactOwnKeys(manifest, [
      'contractVersion',
      'name',
      'origin',
      'author',
      'source',
      'license',
      'purpose',
      'units',
      'coordinates',
      'applicability',
      'numericalSemantics',
      'controls',
      'reproducibility',
      'resources',
      'services',
      'validation'
    ]) ||
    manifest.contractVersion !== 1 ||
    manifest.units !== 'm-rad-s' ||
    manifest.coordinates !== 'right-handed-y-up' ||
    !['official', 'example', 'private'].includes(manifest.origin as string) ||
    ![
      'name',
      'author',
      'source',
      'license',
      'purpose',
      'applicability',
      'numericalSemantics',
      'controls',
      'reproducibility',
      'resources'
    ].every((key) => text(manifest[key])) ||
    !hasExactOwnKeys(manifest.services, [
      'network',
      'additionalFiles',
      'commercialRuntime'
    ]) ||
    !Object.values(manifest.services).every(
      (value) => typeof value === 'boolean'
    ) ||
    !hasExactOwnKeys(manifest.validation, ['status', 'evidence']) ||
    !['unverified', 'conformance-tested', 'numerically-validated'].includes(
      manifest.validation.status as string
    ) ||
    !text(manifest.validation.evidence)
  )
    throw new Error('Invalid or incompatible method manifest')
  validateParameterSchema(input.parameterSchema)
}
