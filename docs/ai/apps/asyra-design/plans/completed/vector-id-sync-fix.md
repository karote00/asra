# Plan: Vector ID and Name Synchronization Fix

## Objective
Ensure that `idCounter` and `nameCounter` are always synchronized with existing data, preventing ID/name duplication when creating new elements or properties, particularly after a page reload.

## Problem Statement
Users reported that creating new vector points would sometimes overwrite or affect existing vector elements. This was suspected to be due to ID collisions where a new element or property would be assigned an ID already in use because the counters were not properly initialized from the loaded project data.

## Implementation Summary

### 1. Robust Counter Synchronization
Modified the `load` method in both `idCounter.ts` and `nameCounter.ts` (in `@asyra/utils`) to automatically initialize a counter for a type if it doesn't already exist. This ensures that the counter starts at the correct value based on existing data.

### 2. Standardized Type-Prefix Mapping
Refactored `increase` and `valid` methods in the counters to use the stored prefix instead of deriving it from the type string. This provides more reliable mapping for custom types like 'vector' (prefix 'v').

### 3. Dynamic Component Consistency
Updated `create-dynamic-component.ts` in `@asyra/scene-tree` to use the component's `type` as the key for counter operations, ensuring consistency with how `defineComponent` registers them.

### 4. Property ID Generation Fix
Updated `children-map-property-component.ts` in `@asyra/preset` to correctly pass the `childIdType` when creating new child components, ensuring vector points and segments get correct ID prefixes.

### 5. Pen Tool Stability
Fixed a build error in `vector-topology.ts` by changing a constant to a mutable variable (`nextPoints`) where reassignment was required during topological operations.

## Verification Results
- [x] Unit tests for `idCounter` and `nameCounter` synchronization pass.
- [x] Manual tests confirm that adding points after a reload no longer affects old vector data.
- [x] `yarn react:build` succeeds.

## Status
**Completed**
