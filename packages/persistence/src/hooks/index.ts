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

/**
 * Load hook for data transformations
 * Users can register hooks to process data after loading:
 * - Decompression
 * - Decryption
 * - Migration (version upgrades)
 * - Validation
 */
export type LoadHook = (data: CoreRawData) => CoreRawData
