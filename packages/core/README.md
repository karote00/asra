# `@asyra/core`

Strict public composition facade and lifecycle coordinator for current Asyra Framework capabilities.

## Install

```bash
npm install @asyra/core
```

```ts
import core from '@asyra/core'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- composition closure, startup ordering, readiness, teardown, load coordination, and curated package facades
- one pre-start render-engine provider and engine-neutral default adapter

## Does not own

- App-domain rules, UI presentation, concrete engine resources, backend policy, permissions, or the future Core Kernel

## Start here

Use Core for supported App composition and extensions that cross canonical package owners. Register composition before the first `core.start(...)`.

## Lifecycle and composition

Startup validates and closes composition, initializes required runtime owners, loads canonical data, and publishes ready only after success. A failure tears down owned work and never reports false readiness. The current no-provider compatibility branch is not a public Headless lifecycle.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/core.md)
- [Model information before choosing an output](https://github.com/karote00/asyra/blob/main/docs/examples/core-information-model.mjs) — `yarn examples:run core-information-model`
- [Register an app-owned component and schema](https://github.com/karote00/asyra/blob/main/docs/examples/custom-component-schema.mjs) — `yarn examples:run custom-component-schema`
- [Apply the complete official 2D baseline](https://github.com/karote00/asyra/blob/main/docs/examples/preset-2d-minimal.mjs) — `yarn examples:run preset-2d-minimal`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
