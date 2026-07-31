import type { PreparedElementDescriptor } from '../common-apis'

export const PREPARED_DRAWING_ARTIFACT_VERSION = 1 as const
export const PREPARED_DRAWING_SLICE_POINT_BUDGET = 2048
export const PREPARED_DRAWING_SLICE_ELEMENT_BUDGET = 32

export interface PreparedDrawingBounds {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

export interface PreparedDrawingSlice {
  readonly descriptors: readonly PreparedElementDescriptor[]
  readonly pointCount: number
  readonly roles: readonly string[]
}

export interface PreparedDrawingArtifact {
  readonly artifactVersion: typeof PREPARED_DRAWING_ARTIFACT_VERSION
  readonly compositionRole: string
  readonly elementCount: number
  readonly groupBounds: PreparedDrawingBounds
  readonly groupDescriptor: PreparedElementDescriptor
  readonly parent: 'workspace'
  readonly pointCount: number
  readonly roleToElementIds: Readonly<Record<string, readonly string[]>>
  readonly skipped: readonly {
    readonly reason: 'duplicate-role'
    readonly role: string
  }[]
  readonly slices: readonly PreparedDrawingSlice[]
}
