import type { Core } from '@asyra/core'
import { registerAppVersionMigrations } from './app-owned-versioned-load-migration.mjs'

declare const core: Core

registerAppVersionMigrations(core, {
  migrations: [
    {
      from: 'v1',
      to: 'v2',
      migrate: (document) => ({ ...document, version: 'v2' })
    }
  ]
})
