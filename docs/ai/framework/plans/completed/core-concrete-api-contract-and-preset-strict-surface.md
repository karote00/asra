# Completed Plan: Core Concrete API Contract and Preset Strict Surface

## Completed On

- March 5, 2026.

## Final Decision

1. Core exposes concrete API tiers so consumers can distinguish always-available methods from extension surfaces.
2. Preset bootstrapping consumes a strict required core subset (`CorePresetInstallAPIs`) without optional capability checks.
3. `setSystemProperty` is treated as a concrete core API and should be called directly when used.

## Implementation Summary

1. Added exported core type tiers (`CoreBasicAPIs`, `CoreExtensionAPIs`, `CoreConcreteAPIs`, `CorePresetInstallAPIs`, `CorePresetDependencies`).
2. Switched preset core typing to strict core-exported types and removed optional `registerDataChannelObserver` / `getPresetDependencies` guards.
3. Updated test/runtime call sites to remove optional chaining around `setSystemProperty` where the concrete core contract applies.
4. Synced framework package/API docs to reflect the new core contract boundary.

## Exit Criteria Check

1. Preset no longer uses optional `core?.xxx` checks for required core installation APIs.
2. Concrete core API usage for `setSystemProperty` is direct in updated call paths.
3. Documentation and type surfaces agree on concrete vs extension API boundaries.
