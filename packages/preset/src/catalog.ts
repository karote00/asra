import { PresetDefaults, PresetProfiles } from './constants'
import type {
  PresetCatalogContract,
  PresetDefaultCatalogEntry,
  PresetProfileCatalogEntry
} from './types'

const profiles: readonly PresetProfileCatalogEntry[] = [
  {
    id: PresetProfiles['2D'],
    available: true,
    presetEngineId: '@asyra/render-engine-pixi'
  },
  {
    id: PresetProfiles['3D'],
    available: false,
    presetEngineId: null
  },
  {
    id: PresetProfiles.HYBRID,
    available: false,
    presetEngineId: null
  },
  {
    id: PresetProfiles.CUSTOM,
    available: true,
    presetEngineId: null
  }
]

const defaults: readonly PresetDefaultCatalogEntry[] = [
  {
    id: PresetDefaults.BASIC_SHAPES,
    available: true,
    requires: []
  },
  {
    id: PresetDefaults.CONTAINERS,
    available: true,
    requires: []
  },
  { id: PresetDefaults.VECTOR, available: true, requires: [] },
  { id: PresetDefaults.INPUT, available: true, requires: [] },
  { id: PresetDefaults.SELECTION, available: true, requires: [] },
  {
    id: PresetDefaults.VECTOR_EDITING,
    available: true,
    requires: [PresetDefaults.VECTOR, PresetDefaults.SELECTION]
  },
  { id: PresetDefaults.VIEWPORT, available: true, requires: [] },
  {
    id: PresetDefaults.UI_CONTEXT,
    available: true,
    requires: [PresetDefaults.SELECTION]
  }
]

const freezeCatalog = (
  catalog: PresetCatalogContract
): PresetCatalogContract => {
  catalog.profiles.forEach(Object.freeze)
  catalog.defaults.forEach((entry) => {
    Object.freeze(entry.requires)
    Object.freeze(entry)
  })
  Object.freeze(catalog.profiles)
  Object.freeze(catalog.defaults)
  return Object.freeze(catalog)
}

export const PresetCatalog = freezeCatalog({ profiles, defaults })
