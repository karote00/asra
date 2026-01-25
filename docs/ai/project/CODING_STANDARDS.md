# Coding Standards

**READ THIS FIRST** - This document contains essential coding standards for the Asra project.

## 🚨 Prime Directive: Monorepo Import Rule

### CROSS-PACKAGE IMPORTS: USE `@asra/package-name`

**ALWAYS** import from other packages using the monorepo naming convention:

```typescript
// ✅ CORRECT
import { Shape, EntityKind } from '@asra/utils'
import { ShapeEntityImpl } from '@asra/scene-tree'
import { ShapeRenderSystem } from '@asra/render'

// ❌ FORBIDDEN - Never do this
import { Shape } from '../../../utils/src/sceneTree/shapeTypes'
import { ShapeEntityImpl } from '../../../scene-tree/src/components/shape-entity'
import { ShapeRenderSystem } from '../../../render/src/shape-render-system'
```

### SAME-PACKAGE IMPORTS: USE RELATIVE PATHS

**WITHIN the same package**, use relative paths to avoid circular dependencies:

```typescript
// ✅ CORRECT (within @asra/render package)
import { ShapeRenderSystem } from '../shape-render-system'

// ✅ CORRECT (within @asra/scene-tree package)
import { ShapeEntityImpl } from './components/shape-entity'
```

## Why This Matters

1. **Build System Compatibility**: TypeScript can resolve `@asra/package` imports correctly across the monorepo
2. **Dependency Clarity**: Makes cross-package dependencies explicit and traceable
3. **Circular Dependency Avoidance**: Relative imports within same package prevent infinite loops
4. **Monorepo Best Practices**: Follows standard Turborepo/Yarn workspaces conventions

## Enforcement

- **Code Reviews**: Flag any violations of this rule
- **Pre-commit Hooks**: Consider adding linters to catch violations
- **IDE Configuration**: Configure your editor to prefer package imports

## Examples from Asra Codebase

### Shape System Implementation (Reference Implementation)

```typescript
// packages/utils/src/sceneTree/__tests__/integration.test.ts
import { Shape, ShapeRegistry, EntityKind } from '@asra/utils' // ✅ Cross-package
import { ShapeEntityImpl } from '@asra/scene-tree' // ✅ Cross-package
import { ShapeRenderSystem } from '@asra/render' // ✅ Cross-package

// packages/render/src/__tests__/shape-render-system.test.ts
import { ShapeRenderSystem } from '../shape-render-system' // ✅ Same package
import { Shape, ShapeRegistry, EntityKind } from '@asra/utils' // ✅ Cross-package
import { ShapeEntityImpl } from '@asra/scene-tree' // ✅ Cross-package
```

## Quick Checklist

Before committing code, verify:

- [ ] All cross-package imports use `@asra/package-name` format
- [ ] No `../../../packages/` or similar deep relative imports
- [ ] Same-package imports use relative paths
- [ ] Tests build successfully with `yarn workspace @package/name build:package`

---

**Remember: In a monorepo, package boundaries matter. Respect them!**
