# Principle: Docs as Contract

## Intent

Treat framework docs as implementation contracts, not optional commentary.

## Why

- framework behavior is consumed by multiple apps and agents
- refactors need stable meaning, not only passing builds
- retrieval tools depend on consistent, explicit documentation

## Decisions Implied

- when behavior contract changes, update docs in same work
- package docs define ownership and must match code behavior
- routing and API-surface docs are maintained for fast retrieval

## Anti-Patterns

- code changes that silently invalidate documented contracts
- keeping only code-level truth for cross-package decisions
- relying on legacy docs after new framework docs exist

## Design Check

Before merging:
1. Do docs still describe current behavior and ownership accurately?
2. Were changed contracts updated in `rules/*`, `packages/*`, or API docs?
3. Can a new contributor find the correct decision path quickly?
