import type { CoreRawData } from '@asyra/utils'

/**
 * Save hook for data transformations
 * Users can register hooks to process data before saving:
 * - Compression
 * - Encryption
 * - Metadata addition
 * - Validation
 */
export type SaveHook = (data: CoreRawData) => CoreRawData

/** App-owned versioned raw document passed between synchronous load hooks. */
export interface VersionedLoadDocument {
  version: string
}

/**
 * Synchronous load hook for data transformations.
 * Users can register hooks to process raw data after provider I/O and before
 * Core normalization, package validation, and canonical apply:
 * - Decompression
 * - Decryption
 * - Migration (version upgrades)
 * Input is unknown so app code must establish document/version eligibility.
 * Every successful result has a string version; package fields remain raw
 * until Core normalization and package-owner validation after the full chain.
 * Package validation remains owned by Core and the state-owner packages.
 */
export type LoadHook = (data: unknown) => VersionedLoadDocument
