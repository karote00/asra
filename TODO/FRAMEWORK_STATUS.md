# Framework Transformation Status

> **Current State:** Framework - 75% Mature  
> **Last Updated:** January 30, 2026  
> **Transformation Date:** January 30, 2026  
> **Branch:** feature/interaction-registry

---

## Overview

@asyra is now a **true framework** with clear separation between mechanism (framework) and configuration (application). Users can define all events, input mappings, and behaviors without modifying framework packages.

---

## 1. What We Are Now (✅ The Good Parts)

### 1.1 Inversion of Control (IoC) ✅

Framework calls user code via registries:

```typescript
// Framework provides mechanism
InputSystemRegistry.register(eventName, handler)

// App provides configuration - Framework calls back
inputSystem.registry.register('myapp.zoom', [
  { type: InputType.WHEEL, keys: [PointerKey.WHEEL] }
])
```

**Why it matters:**

- Users control all behavior without touching framework
- Unlimited extensibility via registration API
- No hardcoded business logic in framework

---

### 1.2 Well-Defined Extensibility Points ✅

Framework provides multiple extensibility mechanisms:

| Extension Point    | API                              | Purpose                   |
| ------------------ | -------------------------------- | ------------------------- |
| **Input Mappings** | `InputSystemRegistry.register()` | Map inputs to events      |
| **Interactions**   | `InteractionRegistry.register()` | Define behavior responses |
| **Event Types**    | Extend `InputType` const         | Support custom devices    |
| **Event Names**    | Define in app `constants.ts`     | Control event taxonomy    |
| **Initialization** | `initApp()`                      | Orchestrate startup       |

**Example: Custom Device Support**

```typescript
// Define custom input type
export const InputType = {
  ...DefaultInputType,
  VOICE_COMMAND: 'voice.command',
  VR_CONTROLLER: 'vr.controller'
} as const

// Register custom behaviors
inputSystem.registry.register('custom.voice.undo', [
  { type: InputType.VOICE_COMMAND, keys: ['undo'] }
])
```

---

### 1.3 Clear Architecture Enforcement ✅

Framework enforces application structure:

```
apps/asyra-design/src/
├── constants.ts              ✅ Event names & values (WHAT)
├── init/                     ✅ Initialization (HOW)
│   ├── index.ts
│   ├── init-app.ts          ✅ Unified entry point
│   ├── init-input-system.ts ✅ Input configuration
│   └── init-interactions.ts ✅ Interaction configuration
```

**Benefits:**

- Consistent app structure
- Clear separation of concerns
- Easy onboarding for developers

---

### 1.4 Mechanism vs Configuration Separation ✅

**Framework provides mechanism:**

```typescript
InputSystemRegistry.register() // HOW to register
InputSystem.on() // HOW to listen
checkCombinations() // HOW input detection works
```

**App provides configuration:**

```typescript
inputSystem.registry.register('zoom.in', [{ type: 'wheel', keys: ['scroll'] }]) // WHAT events exist
```

**Benefits:**

- Framework upgrades don't break app configs
- Apps can be entirely independent
- Zero coupling between framework implementation and app usage

---

### 1.5 Framework Pattern Recognition ✅

@asyra follows established framework patterns:

| Pattern              | Implementation                   | Comparison to Industry            |
| -------------------- | -------------------------------- | --------------------------------- |
| **Registry Pattern** | `InputSystemRegistry.register()` | Express middleware, React context |
| **Event System**     | Reactive events subscription     | RxJS, Redux                       |
| **Orchestrator**     | `initApp()` unified entry        | Angular bootstrap, Vue mount      |
| **Type System**      | Strong TypeScript typing         | React, Angular frameworks         |

---

### 1.6 Extensibility Without Framework Modification ✅

**Before (Library pattern):**

- To add event: Modify `@asyra/input-system/src/event-mappings.ts`
- To add device: Modify `@asyra/utils/src/constants/input.ts`
- Fork framework for customization ❌

**After (Framework pattern):**

- To add event: Define in app `constants.ts`
- To add device: Extend `InputType` in app
- Use framework as-is ✅

**Real-world examples now possible:**

- Voice command inputs
- VR controller support
- Eye tracking for accessibility
- Touch gestures for mobile
- Gamepad inputs
- Brain-computer interface

---

## 2. What We Can Improve (⚠️ The Missing Parts)

### 2.1 Runtime Extensibility ⚠️ Low Priority

**Current state:** All configuration loaded at initialization time

**Missing capabilities:**

```typescript
// Hot-reloading without app restart
inputSystem.registry.reload()

// Runtime plugin injection
inputSystem.registry.registerPlugin(customPlugin)

// Dynamic configuration updates
inputSystem.registry.updateEvent('zoom', newCombos)
```

**Impact:** Medium

- Users must restart app to change configs
- Can't dynamically load features
- Not suitable for plugin-based architectures

---

### 2.2 Plugin System ⚠️ Low Priority

**Current state:** Registry-based extensibility, no formal plugin API

**Missing:**

```typescript
// Plugin registration
inputSystem.plugins.register(zoomPlugin, {
  version: '1.0.0',
  name: 'Smooth Zoom',
  init: () => {},
  unload: () => {}
})

// Plugin dependencies
inputSystem.plugins.register(complexPlugin, {
  dependencies: ['zoom@^1.0.0']
})

// Plugin lifecycle hooks
inputSystem.plugins.on('before:register', (event) => {})
```

**Impact:** Medium

- No plugin discovery mechanism
- No dependency management
- No plugin isolation
- Hard to distribute third-party extensions

---

### 2.3 Configuration Schema Validation ⚠️ Medium Priority

**Current state:** TypeScript provides type safety, but no runtime validation

**Missing:**

```typescript
// Validate user configurations
inputSystem.registry.validate(pluginConfig)

// Error messages for invalid configs
// "Invalid keys: ['KeyX'] - key not supported"

// Config schema definition
const pluginSchema = {
  type: 'object',
  properties: {
    combos: { type: 'array', items: InputEventComboSchema }
  }
}
```

**Impact:** High (for production use)

- Invalid configs crash at runtime
- Poor error messages
- Hard to debug configuration issues

---

### 2.4 Performance Optimization ⚠️ Medium Priority

**Current state:** Registry lookup overhead

**Missing:**

```typescript
// Optimized lookup tables
inputSystem.registry.buildLookupTable()

// Event batching
inputSystem.registry.on(['event1', 'event2'], handler)

// Debouncing/Throttling
inputSystem.registry.register(event, handler, {
  debounce: 100,
  throttle: 50
})
```

**Impact:** High (for complex apps)

- Multiple key combinations may be slow
- Frequent events (wheel, mousemove) may cause performance issues
- No event batching for high-frequency inputs

---

### 2.5 Debugging & Developer Tools ⚠️ Medium Priority

**Current state:** Built-in TypeScript types

**Missing:**

```typescript
// Debug mode
inputSystem.debug.logEvent('drag.start', { timestamp, combo })

// Event tracing
inputSystem.trace.enable('drag.*')

// Visual devtools
inputSystem.devtools.showRegistry()
inputSystem.devtools.testEvents()

// Config generation
inputSystem.registry.exportConfig() // Save config to file
inputSystem.registry.importConfig(json) // Load from file
```

**Impact:** Medium

- Hard to debug event flow
- Can't visualize registry state
- No event replay/tracing

---

### 2.6 Documentation for Extensions ⚠️ High Priority

**Current state:** Code-level documentation exists

**Missing:**

- Guide: "How to create custom input devices"
- Guide: "Building plugins for @asyra"
- Examples: Custom device implementations
- Best practices: Registry usage patterns
- Migration guide: From v1.0 to v2.0

**Impact:** High (for adoption)

- Barrier to entry for extending framework
- Inconsistent patterns across users
- Hard to maintain complex apps

---

## 3. TODO / Checklist for Missing Parts

### Phase 1: Critical Foundation (High Priority)

- [ ] **3.1 Create Configuration Schema**

  - [ ] Define `InputEventComboSchema` using Zod or similar
  - [ ] Implement validation in `InputSystemRegistry.register()`
  - [ ] Add error messages with line numbers

- [ ] **3.2 Add Developer Environment Variable**

  ```typescript
  // Support debug mode
  if (import.meta.env.DEV) {
    inputSystem.enableDebugMode()
  }
  ```

- [ ] **3.3 Implement Error Boundaries**

  - [ ] Catch invalid registrations at compile time
  - [ ] Provide helpful error messages
  - [ ] Example: `"Invalid key: 'KeyX'. Did you mean 'KeyZ'?"`

- [ ] **3.4 Write Extension Guides**
  - [ ] How to create custom input devices
  - [ ] How to define custom event names
  - [ ] Best practices for registry usage
  - [ ] Migration guide from v1.0 to v2.0
  - [ ] Example: VR controller integration

---

### Phase 2: Performance & Debugging (Medium Priority)

- [ ] **3.5 Implement Lookup Optimization**

  ```typescript
  // Build optimized lookup tables at init
  inputSystem.registry.buildLookupTable()
  ```

- [ ] **3.6 Add Event Tracing**

  ```typescript
  inputSystem.trace.enable('*') // All events
  inputSystem.trace.enable('drag.*') // Drag events only
  inputSystem.trace.export() // Export trace log
  ```

- [ ] **3.7 Create Debug UI**
  ```typescript
  inputSystem.devtools.show()
  // Shows:
  // - All registered events
  // - Active event mappings
  // - Real-time event flow
  ```
- [ ] **3.8 Config Export/Import**
  ```typescript
  // Save/load configurations
  const config = inputSystem.registry.exportConfig()
  inputSystem.registry.importConfig(config)
  ```

---

### Phase 3: Plugin System (Low Priority, High Effort)

- [ ] **3.9 Design Plugin API**

  - [ ] Define `Plugin` interface
  - [ ] Define `PluginContext` for plugins
  - [ ] Define plugin lifecycle hooks

- [ ] **3.10 Implement Plugin Registry**

  ```typescript
  inputSystem.plugins.register(pluginName, plugin)
  inputSystem.plugins.load(pluginPath)
  inputSystem.plugins.unload(pluginName)
  ```

- [ ] **3.11 Add Plugin Dependencies**

  - [ ] Semantic versioning support
  - [ ] Dependency resolution
  - [ ] Conflict detection

- [ ] **3.12 Create Plugin Sandboxing**
  - [ ] Isolate plugin state
  - [ ] Prevent plugin interference
  - [ ] Resource cleanup on unload

---

### Phase 4: Runtime Extensibility (Low Priority)

- [ ] **3.13 Hot Configuration Reload**

  ```typescript
  inputSystem.registry.reloadConfig()
  // Re-reads configs from file system
  ```

- [ ] **3.14 Dynamic Event Registration**

  ```typescript
  inputSystem.registry.register('dynamic.event', combos, {
    mode: 'replace' | 'append' | 'prepend'
  })
  ```

- [ ] **3.15 Event Batching**
  ```typescript
  inputSystem.registry.on(['event1', 'event2'], handler)
  ```

---

### Phase 5: Documentation & Examples (High Priority)

- [ ] **3.16 Create Extension Documentation**

  - [ ] Guide: Custom Input Devices
  - [ ] Guide: Event Naming Conventions
  - [ ] Guide: Registry Usage Patterns
  - [ ] Guide: Performance Optimization

- [ ] **3.17 Build Example Apps**

  - [ ] Example 1: Basic canvas editor
  - [ ] Example 2: Voice-controlled app
  - [ ] Example 3: VR controller support
  - [ ] Example 4: Touch gesture app
  - [ ] Example 5: Complex multi-device app

- [ ] **3.18 Create Migration Guide**

  - [ ] v1.0 → v2.0 migration guide
  - [ ] Breaking changes documentation
  - [ ] Code examples for migrating

- [ ] **3.19 Write Best Practices Guide**
  - [ ] Event naming patterns
  - [ ] Registry organization
  - [ ] Performance considerations
  - [ ] Testing approaches

---

## Framework Maturity Score

| Category                           | Score      | Weight   | Weighted Score |
| ---------------------------------- | ---------- | -------- | -------------- |
| **Inversion of Control**           | 9/10       | 30%      | 2.7            |
| **Extensibility Points**           | 8/10       | 25%      | 2.0            |
| **Architecture Enforcement**       | 7/10       | 15%      | 1.05           |
| **Mechanism vs Config Separation** | 9/10       | 15%      | 1.35           |
| **Runtime Extensibility**          | 4/10       | 5%       | 0.2            |
| **Documentation Quality**          | 6/10       | 10%      | 0.6            |
| **Total Score:**                   | **7.9/10** | **100%** |                |

**Framework Classification: ✅ Mature Framework**

---

## Conclusion

@asyra is now a **mature framework** with:

- ✅ Strong Inversion of Control
- ✅ Multiple extensibility points
- ✅ Clear architecture patterns
- ✅ Good separation of concerns

**Next priorities:**

1. Documentation for extensions (High)
2. Config validation (High)
3. Debug/dev tools (Medium)
4. Performance optimization (Medium)
5. Plugin system (Low)
6. Runtime extensibility (Low)

**Progress tracking:**

- Phase 1 (Foundation): 0/4 complete
- Phase 2 (Perf/Debug): 0/4 complete
- Phase 3 (Plugins): 0/4 complete
- Phase 4 (Runtime): 0/3 complete
- Phase 5 (Docs): 0/4 complete

**Overall progress:** 0/19 items complete (0%)

---

## References

- **Architecture Guide:** [`docs/ai/project/AI_ARCHITECTURAL_GUIDE.md`](docs/ai/project/AI_ARCHITECTURAL_GUIDE.md)
- **Event Architecture:** [`docs/ai/project/AI_ARCHITECTURAL_GUIDE.md#vii-communication-driven-development-cdd-insights`](docs/ai/project/AI_ARCHITECTURAL_GUIDE.md#vii-communication-driven-development-cdd-insights)
- **Input System PRD:** [`docs/ai/project/prd/input-system.md`](docs/ai/project/prd/input-system.md)
- **Workflow Guide:** [`docs/ai/WORKFLOW.md`](docs/ai/WORKFLOW.md)
