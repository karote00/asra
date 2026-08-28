# Tool Contexts

This folder contains project-owned development-tool contexts. Tools may support
Framework and Apps, but they are not Framework runtime packages and do not
become product dependencies merely because they inspect or validate them.

Current tools:

- [`flow-inspector/`](flow-inspector/README.md) — static architecture contract
  viewer and the planned workflow control plane.

Each tool folder owns its purpose, architecture, operational boundaries, plans,
tool-scoped decision history, and public tool contracts when they exist.

Project-wide hard rules remain in `docs/ai/framework/rules/*`. Framework
contracts remain in `docs/ai/framework/*`, and App contracts remain in
`docs/ai/apps/*`.
