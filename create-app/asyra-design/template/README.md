# Asyra Design standalone template

This generated app is the reference Framework consumer for the Asyra 0.5.0
release set. It installs exact Framework package versions from the public npm
registry and imports only declared public entrypoints.

## Requirements

- Node.js 24.x
- Yarn 4.3.1

## Install and verify

```bash
yarn install
yarn typecheck
yarn react:build
yarn test
```

The release gate invokes the packed create-app CLI in an isolated directory,
lets every `@asyra/*` dependency resolve from the public npm registry, and then
runs those commands. It does not use workspace packages, local Framework
tarballs, or dependency resolutions. It also starts the app and verifies the
document and interaction flows.

## Start the app

```bash
yarn start
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

Every `fileId` uses the socket-authoritative document-session path. The
generated local environment points `VITE_COLLABORATION_WS_URL` at the reference
WebSocket service:

```dotenv
VITE_COLLABORATION_WS_URL=ws://127.0.0.1:4101/collaboration
```

Start the reference services in separate terminals before starting the app:

```bash
yarn document:backend
yarn collaboration:server
yarn start
```

The explicit endpoint keeps the frontend and reference WebSocket service
separate during local development. If that service is unavailable or does not
complete its handshake, the app enters its disconnected state, starts with the
formal provisional document, and local editing remains available. Local
publications remain in the app-owned recovery outbox for a later reconnect.
Clearing the endpoint intentionally selects the same-origin `/collaboration`
deployment route; it does not select a different document mode.

## Optional AI

AI execution is user-initiated. To opt in to AI, open the AI control and submit
an intent. Ordinary model-backed execution is disabled until the app server
process has all three server-only settings:

```dotenv
AI_PROVIDER_ENDPOINT=https://your-adapter.example/actions
AI_PROVIDER_MODEL=your-model
AI_PROVIDER_API_KEY=your-secret
```

The endpoint must be HTTPS, except for loopback development. The browser
receives none of these values; the API key is sent only by the server as a
Bearer credential. The adapter receives the backend-owned App domain prompt,
image-tool catalog, and input, and must return one compatible action batch.

App initialization creates no model request, reads no provider secret, and
opens no AI network connection. Provider execution begins only after the
explicit user action and remains behind the app-owned action, permission,
Feature, and transaction boundaries. The checked-in `crdt-7076` sample is a
separate deterministic backend interceptor route and does not load provider
configuration or the App domain prompt.

## Release boundary

This template demonstrates the supported Core and Preset 2D profile. Auto
layout, unit-aware aggregation, production 3D, and production HYBRID profiles
are not part of this release.
