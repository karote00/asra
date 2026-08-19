# Asyra Framework starter

This project is a minimal React starting point created by `create-asyra-app`.
It contains the original Asyra Framework logo and no product-domain behavior,
so you can introduce only the Framework capabilities your product needs.

## Start

Use the package manager selected during creation:

```bash
yarn start
```

Open `http://localhost:3000`.

## Build your product

Read [`AGENTS.md`](AGENTS.md) and [`docs/framework.md`](docs/framework.md)
before editing. The Framework guide explains ownership, registered Features,
transaction boundaries, canonical state, Preset defaults, and supported public
entrypoints.

Keep domain meaning, schemas, workflows, permissions, services, and UI in your
App. Add Framework packages only when the composition needs them.

## Verify

```bash
yarn typecheck
yarn react:build
yarn test
```

For the homepage browser contract and screenshot:

```bash
yarn test:e2e
```

## Support and contribution policy

This repository does not accept external issues or contributions, including
pull requests. You may use and fork this generated project under the MIT
License. Follow the upstream security policy for sensitive reports.

## License

[MIT](LICENSE)
