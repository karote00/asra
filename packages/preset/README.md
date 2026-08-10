# `@asyra/preset`

Optional official design-tool baseline with selectable defaults and render profile policy.

## Requirements

- Node.js 24.x
- Yarn 4.3.1 for this repository's maintained workflows

## Install

```bash
npm install @asyra/preset
```

```ts
import { applyPreset } from '@asyra/preset'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- strict profile/default resolution, dependency expansion, deterministic installation, official defaults, and current `2D` provider selection

## Does not own

- Core lifecycle, App-domain behavior, UI command policy, custom-engine implementation, or unavailable production profiles

## Start here

Apply all defaults, select only the defaults you need, choose `CUSTOM`, or omit Preset for a fully custom product.

## Lifecycle and composition

Preset validates the full selection, installs in catalog order, optionally binds the profile provider, and returns a frozen result. It never starts Core. Failed installation rolls back owned work; an empty defaults list installs nothing.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/preset.md)
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
