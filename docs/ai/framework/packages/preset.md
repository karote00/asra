# Package: @asyra/preset

## Responsibility

Optional preset bootstrap for framework defaults.

## Owns

- explicit application of bundled default registrations
- preset-level coordination across framework packages
- builtin component registrations
- builtin property-component registrations
- builtin property-schema registrations
- builtin render-layer registrations
- builtin selection registrations
- builtin base/system/aggregate UI-property registrations

## Must Not Own

- core lifecycle ownership
- domain/package runtime state ownership

## Current Contract

- `applyPreset(core)` applies preset-provided registrations using explicit app call.
- `applyPreset(core)` is the owner of framework default/builtin wiring that was previously implicit or app-local.
- reactive-events remains infrastructure and does not require preset bootstrap registration.

## Validation Checklist

- Applying preset multiple times does not corrupt runtime registration state.
- App startup works when preset is applied explicitly.
