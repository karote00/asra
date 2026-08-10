# `@asyra/ui-context`

Optional derived UI-property registration and aggregation runtime.

## Install

```bash
npm install @asyra/ui-context
```

```ts
import uiContext from '@asyra/ui-context'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- derived property definitions, compute callbacks, managed observables, aggregate/mixed/empty semantics, and cleanup

## Does not own

- canonical model state, mirror stores, automatic controls, field mappings, App command policy, or polling-based recompute

## Start here

Use it when panels and controls need reusable derived values. A custom App may derive directly from public owner subscriptions.

## Lifecycle and composition

Registration creates one managed derived source; canonical dependency changes request recompute and only the final derived value is published. Compute failure is a UI derivation failure and cannot replace or roll back canonical state.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/ui-context.md)
- [Extend a generated Asyra Design app](https://github.com/karote00/asyra/blob/main/apps/asyra-design/examples/review-queue-extension.mjs) — `yarn examples:run generated-design-app-extension`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
