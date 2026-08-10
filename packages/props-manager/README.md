# `@asyra/props-manager`

Canonical property definitions, values, property-child graph, validation, and registration lifecycle.

## Install

```bash
npm install @asyra/props-manager
```

```ts
import propsManager from '@asyra/props-manager'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- property type definitions, schemas/defaults, runtime values, child relations, and prepared atomic mutation artifacts

## Does not own

- scene hierarchy, UI controls, render projection, App-domain meaning, document migration, or presentation fallbacks

## Start here

Use it for structured canonical component properties and validation; use Core for cross-owner element/property operations.

## Lifecycle and composition

Complete definitions validate before publication. Runtime writes reject invalid explicit values before mutation. Prepared mutations are instance-bound, registration-bound, one-shot artifacts; stale, reused, foreign, or invalid artifacts fail before apply.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/props-manager.md)
- [Register an app-owned component and schema](https://github.com/karote00/asyra/blob/main/docs/examples/custom-component-schema.mjs) — `yarn examples:run custom-component-schema`
- [Model information before choosing an output](https://github.com/karote00/asyra/blob/main/docs/examples/core-information-model.mjs) — `yarn examples:run core-information-model`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
