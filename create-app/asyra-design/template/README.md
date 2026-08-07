# Design App standalone template

This generated app is the reference Framework consumer for the Design App 0.2.5
release set. It installs Framework packages through their public package
artifacts and imports only declared public entrypoints.

## Requirements

- Node.js 24.x
- Yarn 4.3.1

## Install and verify

```bash
yarn install
yarn react:build
yarn test
```

The release gate runs those commands in a clean directory with every
`@asyra/*` dependency resolved from a packed tarball. It also starts the
production preview and verifies the root document response.

## Start the app

```bash
yarn react:start
```

Open `http://localhost:3000/?fileId=my-design`. A non-empty `fileId` is
required as the document-session identity.

## Framework flows demonstrated here

- `src/contexts/core.ts` constructs the app-owned Core composition from public
  packages.
- `src/init/init-app.ts` applies the public Preset 2D composition.
- `src/collaboration/lifecycle.ts` passes persisted checkpoints to
  `core.load(...)`; Core owns version validation and migration before the
  document becomes active.
- `src/common-apis/hierarchy.ts` routes Group, ungroup, reparent, and reorder
  operations through the public Preset Group adapters and one transaction
  boundary.
- `src/ai/transaction.ts` and `src/features/ai-agent/index.ts` route an AI
  action plan through app-registered actions, permission or confirmation,
  the app-owned Feature lifecycle, and one undo commit.

## Document session and local services

Every `fileId` uses the socket-authoritative document-session path. When
`VITE_COLLABORATION_WS_URL` is empty, the app attempts the same-origin
`/collaboration` WebSocket route. If that service is unavailable or does not
complete its handshake, the app enters its disconnected state, starts with the
formal provisional document, and local editing remains available. Local
publications remain in the app-owned recovery outbox for a later reconnect.

To exercise the complete reference collaboration and persistence flow, set:

```dotenv
VITE_COLLABORATION_WS_URL=ws://127.0.0.1:4101/collaboration
```

Then start the reference services in separate terminals:

```bash
yarn document:backend
yarn collaboration:server
yarn react:start
```

The explicit endpoint keeps the frontend and reference WebSocket service
separate during local development. It does not select a different document
mode.

## Optional AI

AI execution is user-initiated. To opt in to AI, open the AI control and submit
an intent. App initialization creates no model request, reads no provider
secret, and opens no AI network connection. Provider execution begins only
after that explicit action and remains behind the app-owned action,
permission, Feature, and transaction boundaries.

## Release boundary

This template demonstrates the supported Core and Preset 2D profile. Auto
layout, unit-aware aggregation, production 3D, and production HYBRID profiles
are not part of this release.
