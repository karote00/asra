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
export {
  getRenderableStrokes,
  getStrokeHitWidth,
  normalizeStrokeSpec
} from './components/stroke-render/renderable-stroke'
export type {
  NormalizeStrokeSpecResult,
  RenderableStroke,
  StrokeSpecRejectionDiagnostic,
  StrokeSpecRejectionReason
} from './components/stroke-render/renderable-stroke'
export {
  getStrokeProductFamilyMatrix,
  resolveSourceFamily
} from './components/stroke-render/resolved-source-family'
export type {
  StrokeProductFamilyMatrixEntry,
  StrokeProductFamilyRuleEvidence,
  StrokeProductFamilyScope,
  StrokeProductFamilyStatus,
  ResolvedSourceBlockedReason,
  ResolvedSourceFamily,
  ResolvedSourceSupportState
} from './components/stroke-render/resolved-source-family'
export {
  buildDomainPlanSplitRangeDashDomains,
  resolveStrokeDomains
} from './components/stroke-render/stroke-domain-plan'
export type {
  ResolveStrokeDomainsInput,
  StrokeDomainBlockedReason,
  StrokeDomainPlan,
  StrokeIntervalDomainKind,
  StrokeLegalBoundaryDomain,
  StrokeSideAuthority
} from './components/stroke-render/stroke-domain-plan'
export { allocateStrokeIntervalsForDomainPlan } from './components/stroke-render/dashed-center-stroke-intervals'
export type {
  StrokeIntervalAllocation,
  StrokeIntervalDomainPlanInput
} from './components/stroke-render/dashed-center-stroke-intervals'
export {
  buildStrokeRegionPacketsFromFinalFaces,
  buildStrokeRegionPacketsFromResolvedPackets
} from './components/stroke-render/stroke-region-packet'
export type {
  StrokeRegionPacket,
  StrokeRegionRevisionSet
} from './components/stroke-render/stroke-region-packet'
export { attachStrokePaintPayload } from './components/stroke-render/stroke-paint-payload'
export type {
  AttachedStrokePaintPayload,
  PaintAttachedStrokeRegion,
  StrokePaintPayload
} from './components/stroke-render/stroke-paint-payload'
export {
  buildStrokeFinalFacesFromPaintAttachedRegions,
  buildStrokeFinalFacesFromResolvedPackets,
  collapseExactDuplicateFinalFaces
} from './components/stroke-render/stroke-final-face'
export type {
  StrokeFinalFace,
  StrokeFinalFaceDebugMetaBase
} from './components/stroke-render/stroke-final-face'
export { buildStrokeRuntimeDiagnosticBranch } from './components/stroke-render/stroke-runtime-diagnostics'
export type {
  BuildStrokeRuntimeDiagnosticBranchInput,
  StrokeRuntimeDiagnosticBranch,
  StrokeRuntimeDiagnosticDirtyStageTrace,
  StrokeRuntimeDiagnosticLegalDomainProvenance,
  StrokeRuntimeDiagnosticOwnerProvenance,
  StrokeRuntimeDiagnosticSupportState
} from './components/stroke-render/stroke-runtime-diagnostics'
