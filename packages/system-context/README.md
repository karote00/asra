# `@asyra/system-context`

Registered managed global/runtime properties for modes, viewport values, and App/system flags.

## Requirements

- Node.js 24.x
- Yarn 4.3.1 for this repository's maintained workflows

## Install

```bash
npm install @asyra/system-context
```

```ts
import systemContext from '@asyra/system-context'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- managed property registration, validation, observable values, snapshots, persistence eligibility, and one-shot load artifacts

## Does not own

- entity graphs, component properties, UI binding, render output, default event subscriptions, or App command policy

## Start here

Use it for small global values that are not entity/property graph data. Define value, validation, and runtime-only policy before use.

## Lifecycle and composition

Runtime writes validate before update. Load produces an instance-bound artifact that applies once without validator replay. Missing, foreign, stale, reused, or invalid artifacts fail before mutation; runtime-only values remain outside persistence.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/system-context.md)
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
