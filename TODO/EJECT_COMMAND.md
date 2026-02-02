# Eject Command for Customizable Defaults

**Status:** Concept / Planned

## Overview

Provide an `eject` command that allows users to copy default patterns (workflow, rules, events, subscribers) from asyra-design into their own application, giving them full control while keeping framework infrastructure intact.

## Discussion Conclusion

### Decision: Implement Eject (Option 1 Only)

**YES - Implement:**

- ✅ **Option 1:** Eject defaults (workflow, rules, events, subscribers) to user's app

**NO - Drop:**

- ❌ **Option 2:** Give whole project packages (too similar to cloning repo)

### Why This is Right

1. **Framework remains pure**

   - `core.deps.*`, `eventRegistry`, `APIRegistry` - All framework tools stay intact
   - User only modifies behavior patterns, not infrastructure

2. **Like CRA eject, but better**

   - CRA eject = Remove build config, now you own build infrastructure
   - Our eject = Copy behavior patterns, still use framework tools
   - Users get: Customize behavior + Keep framework support

3. **Clear use case**

   - Users like 80% of asyra-design defaults, want to tweak 20%
   - Users want to understand/use official best practices
   - Users add custom behavior to existing patterns

4. **Easy to maintain**
   - Ejected code = User's responsibility
   - Framework updates don't conflict with ejected code
   - No versioning mismatch between framework and ejected code

## Architecture

```
┌─────────────────────────────────────────┐
│  User's Custom App                      │  ← User can override app-level defaults
│  - My undo/redo workflow                │  ← Can keep or modify ejected patterns
└─────────────────────────────────────────┘
            ↓ eject copies to here
┌─────────────────────────────────────────┐
│  Asyra Design (defaults)                │  ← APP-LEVEL defaults (source of ejected code)
│  - Default undo/redo workflow           │  ← `npx @asyra/core eject` copies from here
│  - Default rules                        │
│  - Default events                       │
│  - Default subscribers                  │
└─────────────────────────────────────────┘
            ↓ stays unchanged
┌─────────────────────────────────────────┐
│  Framework (@asyra/core, etc.)          │  ← NO defaults, just tools (never ejected)
│  - factory.undo/redo                   │  ← Infrastructure only
│  - eventRegistry                       │
│  - core.deps.*                          │
└─────────────────────────────────────────┘
```

## Usage

```bash
# User starts with asyra-design defaults
npm create @asyra/app my-app
cd my-app

# Works out-of-the-box with default patterns
npm run dev

# User wants to customize undo/redo, create element, etc.
npx @asyra/core eject

# Now has full control over patterns
# src/init/
# ├── events/          ← Copied from asyra-design, now user can modify
# ├── rules/           ← Copied from asyra-design, now user can modify
# ├── subscribers/     ← Copied from asyra-design, now user can modify
# ├── workflows/       ← Copied from asyra-design, now user can modify
```

## Implementation Plan

### 1. Create eject package/script

```typescript
// packages/core/bin/eject.ts or @asyra/eject package
import { copySync } from 'fs-extra'
import path from 'path'

const eject = async () => {
  const templatePath = path.join(__dirname, '../templates/defaults')
  const targetPath = process.cwd() + '/src/init'

  // Check if already ejected
  if (fs.existsSync(targetPath)) {
    console.error('❌ Already ejected. src/init/ already exists.')
    process.exit(1)
  }

  // Copy default patterns
  copySync(templatePath, targetPath)

  console.log('✅ Ejected defaults to src/init/')
  console.log('📝 Now you can customize events, rules, subscribers, workflows!')
  console.log(
    '⚙️  Framework tools (core.deps.*, eventRegistry) remain unchanged'
  )
}

export default eject
```

### 2. Extract default patterns from asyra-design

```
apps/asyra-design/src/init/  →  packages/core/templates/defaults/
  ├── events/                   ├── events/
  ├── rules/                    ├── rules/
  ├── subscribers/              ├── subscribers/
  └── workflows/                └── workflows/
```

### 3. Update package.json

```json
{
  "bin": {
    "asyra-eject": "./bin/eject.js"
  }
}
```

### 4. User documentation

Add to README:

````markdown
## Customizing Patterns

By default, your app uses asyra-design's recommended patterns. To customize:

```bash
npx @asyra/core eject
```
````

This copies default patterns to `src/init/`:

- `src/init/events/` - Your event definitions
- `src/init/rules/` - Your decision rules
- `src/init/subscribers/` - Your event handlers
- `src/init/workflows/` - Your workflow bindings

Framework tools remain unchanged:

- `core.deps.*` - All system contexts
- `eventRegistry` - Event infrastructure
- `APIRegistry` - API infrastructure

You can now customize behavior patterns while keeping framework support!

````

## Comparison: Before vs After Eject

### Before Eject (Default from asyra-design):
```typescript
// User imports default patterns from asyra-design
import { initInteractionSubscribers } from '@asyra/asyra-design/init'
initInteractionSubscribers()
````

### After Eject (User's own patterns):

```typescript
// User now has full control
import { initInteractionSubscribers } from './init/subscribers'
initInteractionSubscribers()

// Can modify anything in src/init/
// Framework tools (core.deps.*) still work the same
```

## Key Differences from CRA Eject

|                     | CRA Eject                               | Our Eject                                            |
| ------------------- | --------------------------------------- | ---------------------------------------------------- |
| **What**            | Build infrastructure (webpack, scripts) | App behavior patterns (events, rules, workflows)     |
| **Level**           | Framework internals                     | User-facing defaults                                 |
| **User control**    | Now responsible for build               | Now responsible for behavior                         |
| **Framework still** | ❌ Not at all (you ejected)             | ✅ Yes (core.deps.\*, eventRegistry)                 |
| **Updates**         | ❌ Can't receive CRA updates            | ✅ Framework still updates, only patterns are custom |

## Benefits

1. **Quick start** - New users use asyra-design as-is, no decisions needed
2. **Best practices** - Official patterns baked in, no guessing
3. **Gradual customization** - Start with defaults, eject when needed to tweak
4. **Framework integrity** - Tools never change, only patterns change
5. **Learning path** - Ejected code becomes reference for customization

## Risks & Mitigations

### Risk 1: Users eject prematurely

**Mitigation:**

- Clear documentation when to eject
- Warning before ejecting: "Only eject if you need to customize patterns"
- Ejected patterns should be well-documented

### Risk 2: User loses framework updates

**Mitigation:**

- Clarify: "Framework tools still update, only patterns are ejected"
- Example: "core.deps.render gets new features, your undo logic stays same"
- No version mismatch between frameworks and ejected code

### Risk 3: Ejected code gets outdated

**Mitigation:**

- Document: "Ejected code is yours, update it as needed"
- Provide guidelines for updating patterns when framework versions change
- Changelog includes pattern changes (not just framework APIs)

## Future Enhancements (Not Priority)

- [ ] `npx @asyra/core eject --dry-run` - Preview what will be copied
- [ ] `npx @asyra/core eject --select` - Select which patterns to eject
- [ ] `npx @asyra/core eject --merge` - Merge patterns instead of overwrite
- [ ] Eject version tracking (which framework version ejected from)

## Related Discussions

- **Undo/Redo Defaults** - Factory provides mechanism (HOW), user decides behavior (WHAT)
- **Application-Level Defaults** - asyra-design provides default patterns as best practices
- **Framework Philosophy** - "User defines WHAT, Framework handles HOW"

**Result:** ✅ Eject command provides balance of opinionated defaults + full customization.

---

**Last Updated:** February 1, 2026
