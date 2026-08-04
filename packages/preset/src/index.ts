export { applyPreset } from './preset.js'
export { PresetCatalog } from './catalog.js'
export {
  PresetDefaults,
  PresetProfiles,
  PRESET_APPLY_ERROR_CODES
} from './constants.js'
export { PresetApplyError } from './composition/error.js'
export type {
  ApplyPresetOptions,
  PresetApplyErrorCode,
  PresetApplyResult,
  PresetCatalogContract,
  PresetDefaultCatalogEntry,
  PresetDefaultId,
  PresetProfile,
  PresetProfileCatalogEntry
} from './types.js'
export {
  DEFAULT_COMPONENT_DEFINITIONS,
  DEFAULT_RENDER_STRATEGY_REGISTRATIONS,
  FRAME_COMPONENT_DEFINITION,
  GROUP_COMPONENT_DEFINITION,
  OVAL_COMPONENT_DEFINITION,
  OVAL_RENDER_STRATEGY,
  RECTANGLE_COMPONENT_DEFINITION,
  RECTANGLE_RENDER_STRATEGY,
  VECTOR_COMPONENT_DEFINITION,
  VECTOR_RENDER_STRATEGY,
  FRAME_RENDER_STRATEGY,
  GROUP_RENDER_STRATEGY,
  deriveGroupBounds,
  groupElements,
  moveElementsWithGroupGeometry,
  normalizeGroupsForElements,
  prepareGroupOperation,
  prepareUngroupOperation,
  projectGroupGeometryPropertyUpdates,
  ungroupElement
} from './components/index.js'
export {
  getVectorRenderLocalPoint,
  getVectorRenderWorkspacePoint
} from './components/vector.js'
export type {
  GroupBounds,
  GroupGeometryProjectionCore,
  GroupOperationCore,
  GroupOperationResult,
  GroupHierarchyReadCore,
  NormalizedGroupBounds,
  PreparedGroupOperation,
  PreparedUngroupOperation,
  UngroupOperationResult
} from './components/index.js'
export { PRESET_REGISTRATION_OWNER } from './registration.js'
export {
  InputSystemPropertyKeys,
  PRESET_SYSTEM_PROPERTY_KEYS,
  PresetSystemPropertyKeys,
  SelectionSystemPropertyKeys,
  VectorEditingSystemPropertyKeys,
  ViewportSystemPropertyKeys,
  type PresetSystemPropertyKey
} from './system-property-keys.js'
export * from './events/index.js'
export * from './selection/channels.js'
export * from './selection/ids.js'
export * from './vector/synthetic-handle.js'
