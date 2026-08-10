# `@asyra/selection`

Canonical named selection-channel state and explicit selection queries and operations.

## Install

```bash
npm install @asyra/selection
```

```ts
import selection from '@asyra/selection'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- selected entity ids per registered channel plus deterministic replace, add, remove, clear, and query semantics

## Does not own

- tool decisions, App eligibility, render overlays, entity mutation, UI state, or automatic builtin channel registrations

## Start here

Register the selection channels your product needs, or use the optional official defaults installed by Preset.

## Lifecycle and composition

Registration creates stable channel metadata. Selection operations update only that channel; duplicate or unknown registration and invalid input fail explicitly. Removing projection packages does not transfer selection ownership to UI state.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/selection.md)
- [Model information before choosing an output](https://github.com/karote00/asyra/blob/main/docs/examples/core-information-model.mjs) — `yarn examples:run core-information-model`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
