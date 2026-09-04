import { validateInstalledDescriptor } from './descriptor'
import { METHOD_CATALOG_LIMITS } from './contracts'
import type { InstalledMethodDescriptor, MethodRegistration } from './contracts'

export interface MethodCatalog {
  readonly descriptors: readonly InstalledMethodDescriptor[]
  resolve: (id: string, version: string) => Readonly<MethodRegistration>
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

/** Trusted code is supplied by deployment, never by a project or imported data. */
export function createMethodCatalog(
  registrations: readonly MethodRegistration[]
): MethodCatalog {
  if (
    !Array.isArray(registrations) ||
    registrations.length > METHOD_CATALOG_LIMITS.methods
  )
    throw new Error('Method catalog capacity exceeded')
  const byId = new Map<string, Readonly<MethodRegistration>>(),
    names = new Set<string>()
  for (const input of registrations) {
    validateInstalledDescriptor(input?.descriptor)
    if (typeof input.execute !== 'function')
      throw new Error('Missing trusted method implementation')
    const descriptor = freeze(structuredClone(input.descriptor)),
      name = descriptor.manifest.name.trim().toLowerCase()
    if (byId.has(descriptor.id) || names.has(name))
      throw new Error('Duplicate method ID or name')
    names.add(name)
    byId.set(
      descriptor.id,
      Object.freeze({ descriptor, execute: input.execute })
    )
  }
  return Object.freeze({
    descriptors: Object.freeze(
      [...byId.values()].map((item) => item.descriptor)
    ),
    resolve(id: string, version: string) {
      const entry = byId.get(id)
      if (!entry || entry.descriptor.version !== version)
        throw new Error('Requested method or version is unavailable')
      return entry
    }
  })
}
