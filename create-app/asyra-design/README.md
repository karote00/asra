# create-asyra-design-app

⚠️ **Experimental project. APIs and structure may change before 1.0.**

Official CLI for scaffolding the standalone **Asyra Design** reference app.

## Requirements

- Node.js 24.x
- Yarn, npm, or pnpm

## Create a project

```shell
npx create-asyra-design-app my-project
```

The CLI copies its bundled template, asks which package manager to use, and
installs the generated app dependencies.

For automation, select the package manager without an interactive prompt:

```shell
npx create-asyra-design-app my-project --package-manager=yarn
```

Supported values are `yarn`, `npm`, and `pnpm`. The project name must be one
directory name; absolute paths and parent-directory traversal are rejected.

## Start the project

```shell
cd my-project
yarn react:start
```

Open `http://localhost:3000/?fileId=my-design`. The `fileId` is required as the
document-session identity.

For npm or pnpm, use the command printed by the CLI:

```shell
npm run react:start
pnpm react:start
```

## Document-session behavior

The generated app always attempts its socket-authoritative document-session
path. Its default empty `VITE_COLLABORATION_WS_URL` uses the same-origin
`/collaboration` route. When that service is unavailable, the app enters the
disconnected state and local editing remains available through the provisional
document and recovery outbox.

To run the complete reference persistence and collaboration composition, set
`VITE_COLLABORATION_WS_URL` and start `document:backend`,
`collaboration:server`, and `react:start` in separate terminals. The generated
app README contains the complete commands.

## Contributing

- `apps/asyra-design` is the canonical app source.
- `create-app/asyra-design/template` is generated output and must not receive
  hand-written product fixes.

## License

MIT
