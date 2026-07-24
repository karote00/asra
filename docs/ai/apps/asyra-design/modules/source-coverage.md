# Module: Source Coverage Map

Purpose: keep app docs aligned with implemented source modules.

## Covered Runtime Areas

- App shell and mount

  - `src/index.tsx`, `src/app/index.tsx`, `src/render-app/index.tsx`
  - docs: `ARCHITECTURE.md`, `modules/init-and-startup.md`

- Initialization and runtime wiring

  - `src/init/index.ts`, `src/init/init-app.ts`, `src/init/foundation/*`, `src/init/capabilities/*`, `src/init/derived-state/*`, `src/init/diagnostics/*`
  - docs: `modules/init-and-startup.md`, `modules/input-mapping.md`

- App environment and optional collaboration composition

  - `.env`, `app-environment.mjs`, `vite.config.ts`, `vite.collaboration-server.config.ts`, `tsconfig.collaboration-server.json`, `playwright*.config.ts`, `collaboration-server.ts`, `src/collaboration/*`, `src/render-app/collaboration-mode.ts`
  - docs: `modules/collaboration-reference.md`, `API_SURFACES.md`, `ARCHITECTURE.md`

- Input/event mapping

  - `src/config/key-combinations.ts`, `src/constants/*`
  - docs: `modules/input-mapping.md`

- Feature runtime behavior

  - `src/features/*`
  - docs: `features/*`, `bdd-features/*`, `prd/*`

- Canvas overlay render layers

  - `src/render-layers/*`
  - docs: `modules/state-contracts.md`, `prd/properties-panel.md`

- App mutation/query boundary

  - `src/common-apis/*`
  - docs: `modules/common-apis.md`

- App orchestration layer

  - `src/controllers/*`, `src/states/app.ts`, `src/contexts/*`
  - docs: `modules/controllers-and-state.md`

- UI-context/system property wiring

  - `src/init/capabilities/*`, `src/init/derived-state/*`
  - docs: `modules/state-contracts.md`, `modules/init-and-startup.md`

- Provider and UI consumption

  - `src/hooks/*`, `src/providers/*`, `src/contents/*`, `src/toolbar/*`, `src/properties/*`
  - docs: `modules/providers-and-ui.md`, `rules/ui-data-flow.md`

- E2E behavior guardrails
  - `e2e/*.spec.ts`
  - docs: `modules/e2e.md`, `modules/collaboration-reference.md`, `rules/testing-contracts.md`

## Known Placeholder or Infra Files

- `src/animation/*`
  - placeholder panels, no runtime contract yet
- `src/app/__tests__/App.test.tsx`, `src/setupTests.ts`, `src/reportWebVitals.ts`, `src/react-app-env.d.ts`, `src/types.d.ts`
  - test/infra typing files

If any placeholder area becomes runtime behavior, add a dedicated module/feature doc in the same change.
