export { applyPreset } from './preset'
export { enableDefaultExactGeometryBackend } from './exact-geometry-backend'
export * from './events'
export * from './selection/channels'
export {
  getActiveGeometryBackendId,
  getGeometryBackend,
  getGeometryBackendCacheSignature,
  listGeometryBackendIds,
  registerGeometryBackend,
  selectGeometryBackend
} from './components/stroke-render/geometry-backend'
