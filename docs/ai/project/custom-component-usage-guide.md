# Custom Component System - Usage Guide

This guide explains how to use the custom component system to extend the Asyra framework with your own component types.

## Overview

The custom component system allows you to define new component types that integrate seamlessly with the framework. Components are registered using the `defineComponent()` API, which handles all the necessary registrations across different packages.

## Basic Usage

### Defining a Simple Component

```typescript
import { defineComponent, PropertyTypes } from '@asyra/core'

defineComponent({
  type: 'star',
  idPrefix: 'star',
  namePrefix: 'Star',
  properties: [
    { name: 'count', type: PropertyTypes.CUSTOM, defaultValue: 5 },
    { name: 'x', type: PropertyTypes.NUMBER, defaultValue: 0 },
    { name: 'y', type: PropertyTypes.NUMBER, defaultValue: 0 },
    { name: 'width', type: PropertyTypes.NUMBER, defaultValue: 100 },
    { name: 'height', type: PropertyTypes.NUMBER, defaultValue: 100 }
  ]
})
```

### With Custom Render Strategy

```typescript
import { defineComponent, PropertyTypes } from '@asyra/core'
import type { Graphics } from 'pixi.js'
import type { RenderElementData } from '@asyra/render'

defineComponent({
  type: 'star',
  idPrefix: 'star',
  namePrefix: 'Star',
  properties: [
    { name: 'count', type: PropertyTypes.CUSTOM, defaultValue: 5 },
    { name: 'innerRadius', type: PropertyTypes.CUSTOM, defaultValue: 0.5 },
    { name: 'x', type: PropertyTypes.NUMBER, defaultValue: 0 },
    { name: 'y', type: PropertyTypes.NUMBER, defaultValue: 0 },
    { name: 'width', type: PropertyTypes.NUMBER, defaultValue: 100 },
    { name: 'height', type: PropertyTypes.NUMBER, defaultValue: 100 }
  ],
  renderStrategy: (graphic: Graphics, data: RenderElementData) => {
    const count = (data as any).count || 5
    const innerRadius = (data as any).innerRadius || 0.5
    const outerRadius = Math.min(data.width, data.height) / 2
    
    // Draw star shape
    graphic.clear()
    graphic.moveTo(0, 0)
    
    for (let i = 0; i < count * 2; i++) {
      const angle = (Math.PI * i) / count
      const radius = i % 2 === 0 ? outerRadius : outerRadius * innerRadius
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      graphic.lineTo(x, y)
    }
    
    graphic.closePath()
    graphic.fill({ color: 0xffaa00 })
    
    // Position the graphic
    graphic.x = data.x + data.width / 2
    graphic.y = data.y + data.height / 2
  }
})
```

## Component Definition Options

### ComponentDefinition Interface

```typescript
interface ComponentDefinition {
  /**
   * Unique type identifier for the component (e.g., 'star', 'polygon')
   */
  type: string

  /**
   * Prefix for ID generation (e.g., 'star' -> 'star-1', 'star-2')
   */
  idPrefix: string

  /**
   * Prefix for name generation (e.g., 'Star' -> 'Star 1', 'Star 2')
   */
  namePrefix: string

  /**
   * Properties that this component should have
   */
  properties: PropertyDefinition[]

  /**
   * Optional render strategy for this component type
   * If not provided, will use default rectangle rendering
   */
  renderStrategy?: RenderStrategy
}
```

### Property Definition

```typescript
interface PropertyDefinition {
  name: string          // Property name (e.g., 'count', 'sides')
  type: string          // Property type (use PropertyTypes constants)
  alias?: string[]      // Optional aliases for the property
  defaultValue?: any    // Default value when component is created
}
```

## Property Types

The framework provides standard property types:

```typescript
import { PropertyTypes } from '@asyra/utils'

PropertyTypes.NUMBER   // For numeric values
PropertyTypes.STRING   // For text values
PropertyTypes.BOOLEAN  // For true/false values
PropertyTypes.CUSTOM   // For custom/complex values
```

## ID and Name Generation

Components automatically generate unique IDs and names based on the prefixes:

- **ID Prefix**: Used for internal identification (e.g., 'star' → 'star-1', 'star-2', 'star-3')
- **Name Prefix**: Used for display names (e.g., 'Star' → 'Star 1', 'Star 2', 'Star 3')

The framework maintains counters for each prefix to ensure uniqueness.

## Render Strategies

### Default Rendering

If no render strategy is provided, components will use the default rectangle rendering:

```typescript
defineComponent({
  type: 'simple',
  idPrefix: 'simple',
  namePrefix: 'Simple',
  properties: [
    { name: 'x', type: PropertyTypes.NUMBER, defaultValue: 0 },
    { name: 'y', type: PropertyTypes.NUMBER, defaultValue: 0 },
    { name: 'width', type: PropertyTypes.NUMBER, defaultValue: 100 },
    { name: 'height', type: PropertyTypes.NUMBER, defaultValue: 100 }
  ]
  // No renderStrategy - will use default rectangle
})
```

### Custom Rendering

Provide a render strategy function to customize how the component is drawn:

```typescript
renderStrategy: (graphic: Graphics, data: RenderElementData) => {
  // graphic: PixiJS Graphics object to draw on
  // data: Component data including x, y, width, height, and custom properties
  
  // Your custom drawing logic here
  graphic.clear()
  // ... draw your shape
  graphic.x = data.x
  graphic.y = data.y
}
```

## Advanced Examples

### Polygon Component

```typescript
defineComponent({
  type: 'polygon',
  idPrefix: 'poly',
  namePrefix: 'Polygon',
  properties: [
    { name: 'sides', type: PropertyTypes.CUSTOM, defaultValue: 6 },
    { name: 'x', type: PropertyTypes.NUMBER, defaultValue: 0 },
    { name: 'y', type: PropertyTypes.NUMBER, defaultValue: 0 },
    { name: 'width', type: PropertyTypes.NUMBER, defaultValue: 100 },
    { name: 'height', type: PropertyTypes.NUMBER, defaultValue: 100 }
  ],
  renderStrategy: (graphic, data) => {
    const sides = (data as any).sides || 6
    const radius = Math.min(data.width, data.height) / 2
    
    graphic.clear()
    graphic.moveTo(radius, 0)
    
    for (let i = 1; i <= sides; i++) {
      const angle = (Math.PI * 2 * i) / sides
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      graphic.lineTo(x, y)
    }
    
    graphic.closePath()
    graphic.fill({ color: 0x00aaff })
    
    graphic.x = data.x + data.width / 2
    graphic.y = data.y + data.height / 2
  }
})
```

### Component with Property Aliases

```typescript
defineComponent({
  type: 'box',
  idPrefix: 'box',
  namePrefix: 'Box',
  properties: [
    { 
      name: 'position', 
      type: PropertyTypes.CUSTOM, 
      defaultValue: { x: 0, y: 0 },
      alias: ['pos', 'location']  // Can be accessed via 'pos' or 'location'
    },
    { 
      name: 'dimensions', 
      type: PropertyTypes.CUSTOM, 
      defaultValue: { width: 100, height: 100 },
      alias: ['size']  // Can be accessed via 'size'
    }
  ]
})
```

## Unregistering Components

To remove a component type from the system:

```typescript
import { unregisterComponent } from '@asyra/core'

// Unregister the component
const wasUnregistered = unregisterComponent('star')

if (wasUnregistered) {
  console.log('Star component unregistered successfully')
}
```

This removes the component from:
- Component Registry
- Property Registry
- Render Registry

## Best Practices

1. **Unique Type Names**: Use unique type identifiers to avoid conflicts
2. **Descriptive Prefixes**: Choose clear ID and name prefixes for easy identification
3. **Default Values**: Always provide sensible default values for properties
4. **Property Types**: Use appropriate property types (NUMBER for numeric values, CUSTOM for complex objects)
5. **Render Strategy**: Implement efficient render strategies that handle all property variations
6. **Cleanup**: Unregister components when they're no longer needed

## Integration with Framework

Once defined, custom components work seamlessly with the framework:

- They appear in the component registry
- They can be created using `createElement({ type: 'your-type' })`
- They support all standard framework operations (selection, transformation, etc.)
- They integrate with the property system
- They render using your custom strategy or the default

## Example: Complete Star Component

```typescript
import { defineComponent, unregisterComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import type { Graphics } from 'pixi.js'
import type { RenderElementData } from '@asyra/render'

// Define the star component
defineComponent({
  type: 'star',
  idPrefix: 'star',
  namePrefix: 'Star',
  properties: [
    { name: 'count', type: PropertyTypes.CUSTOM, defaultValue: 5 },
    { name: 'innerRadius', type: PropertyTypes.CUSTOM, defaultValue: 0.5 },
    { name: 'x', type: PropertyTypes.NUMBER, defaultValue: 0 },
    { name: 'y', type: PropertyTypes.NUMBER, defaultValue: 0 },
    { name: 'width', type: PropertyTypes.NUMBER, defaultValue: 100 },
    { name: 'height', type: PropertyTypes.NUMBER, defaultValue: 100 },
    { name: 'rotation', type: PropertyTypes.NUMBER, defaultValue: 0 }
  ],
  renderStrategy: (graphic: Graphics, data: RenderElementData) => {
    const count = (data as any).count || 5
    const innerRadius = (data as any).innerRadius || 0.5
    const rotation = (data as any).rotation || 0
    const outerRadius = Math.min(data.width, data.height) / 2
    
    graphic.clear()
    graphic.moveTo(0, 0)
    
    for (let i = 0; i < count * 2; i++) {
      const angle = (Math.PI * i) / count + rotation
      const radius = i % 2 === 0 ? outerRadius : outerRadius * innerRadius
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      graphic.lineTo(x, y)
    }
    
    graphic.closePath()
    graphic.fill({ color: 0xffaa00 })
    graphic.stroke({ color: 0xff6600, width: 2 })
    
    graphic.x = data.x + data.width / 2
    graphic.y = data.y + data.height / 2
  }
})

// Later, when no longer needed:
// unregisterComponent('star')
```

## Troubleshooting

### Component Not Rendering

- Ensure render strategy is provided or default properties (x, y, width, height) are set
- Check that the component type is registered before creating instances
- Verify render strategy doesn't throw errors

### Properties Not Working

- Confirm property names match between definition and usage
- Check that property types are valid
- Ensure default values are provided

### ID/Name Conflicts

- Use unique prefixes for each component type
- Avoid using prefixes that conflict with built-in types

## See Also

- [Custom Component System Refactoring Plan](./custom-component-system-refactoring-plan.md)
- Core Package API Documentation
- Scene Tree Package Documentation
- Render Package Documentation
