# `@asyra/design-system`

Optional reusable React presentation components for product interfaces; it is not part of the Core execution kernel.

## Requirements

- Node.js 24.x
- Yarn 4.3.1 for this repository's maintained workflows

## Install

```bash
npm install @asyra/design-system
```

```ts
import { Button } from '@asyra/design-system'
import '@asyra/design-system/index.css'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- maintained React components, component accessibility behavior, icon names, and package styles

## Does not own

- Core, transactions, canonical documents, input normalization, canvas rendering, or App command policy

## Start here

Use it when a React App wants Asyra's maintained UI pieces. A custom product may use another design system without changing Framework behavior.

## Lifecycle and composition

Components consume ordinary React props and emit UI intent callbacks. Temporary focus, measurement, dismissal, and portal state remain presentation concerns; canonical mutations stay behind App Features and APIs.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/design-system.md)
- [Extend a generated Asyra Design app](https://github.com/karote00/asyra/blob/main/apps/asyra-design/examples/review-queue-extension.mjs) — `yarn examples:run generated-design-app-extension`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
