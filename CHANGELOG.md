# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Framework `0.2.5` release-readiness automation for exact package artifacts,
  clean consumers, the generated Asyra Design template, and release records.
- Public support, migration, security, and package entrypoint documentation for
  all 19 release packages.

### Changed

- Framework packages now publish explicit ESM entrypoints, declaration files,
  package-local licenses, Node.js 20.x engines, and exact internal production
  dependency ranges in packed artifacts.
- The generated Asyra Design template now installs and builds independently
  from packed artifacts without workspace aliases or dependency hoisting.

### Deprecated

- `Core.setPersistence(...)` remains a warn-once, load-only adapter for
  `Core.setLoadSource(...)` during the `0.2.x` migration window.
- `PixiJSRenderer`, `RenderStrategyGraphic`, and `RenderStrategy` remain
  compatibility surfaces for `RenderAdapter`, `RenderGraphics`, and
  `EngineNeutralRenderStrategy`, respectively.

### Removed

- Workspace-only package assumptions from the release artifact and generated
  template validation paths.

### Fixed

- Package metadata, public import specifiers, declared dependencies, and
  CommonJS/ESM Lodash interop detected by clean artifact consumers.

### Security

- Disabled Collaboration and AI compositions are formally verified to create
  no provider, credential, model, timer, listener, or network side effects.
- Added a private security-reporting route and explicit AI/Collaboration
  security ownership.
