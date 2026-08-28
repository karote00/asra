# Development

## Requirements and start

- Node.js 24.x
- Yarn 4.3.1, or the package manager selected by the generator

In the monorepo, install and build from the repository root, then run
`yarn dev:all`. In a generated project:

```bash
yarn start
```

Open `http://localhost:3000/?fileId=my-design`. The `fileId` must be non-empty.

For the complete collaboration and durability path, run these in separate
terminals:

```bash
yarn document:backend
yarn collaboration:server
yarn start
```

## Common changes

- New tool or command: add a registered Feature, centralize identifiers, route
  mutation through a common API, and test both the owner and user behavior.
- New model field: define schema and load fallback with the canonical property
  owner before adding UI controls.
- New panel control: keep the component derived from state; send writes through
  a controller/common API.
- New overlay: register an App render layer through the public Core boundary;
  do not import a concrete render engine.
- New AI action: define App schema, permission, confirmation, and transaction
  execution. Model output is never canonical state.
- New collaboration behavior: keep transport generic and place document/domain
  acceptance policy in the App.

## Verification

Run the focused owner test first. Before handing off a general App change, run:

```bash
yarn typecheck
yarn react:build
yarn test
```

Browser changes also require the relevant Playwright suite. Collaboration
changes require the complete local services and `yarn test:e2e:collaboration`.
Do not treat a screenshot as a substitute for a source-space or state-owner
assertion.
