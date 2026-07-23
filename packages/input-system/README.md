# Input System

A powerful and flexible keyboard and mouse event listener plugin designed for modern web applications. This library simplifies the handling of complex input combinations, making it easier to manage user interactions in your projects.

## Features

- **Cross-Platform Support**: Works seamlessly on Windows, Mac, and Linux.
- **Customizable Key Combinations**: Define your own keyboard shortcuts and mouse actions.
- **Event Listeners**: Easily attach callbacks to specific actions.
- **TypeScript Support**: Built with TypeScript for better type safety and developer experience.

## Installation

You can install the Input System package via npm or yarn:

### Using npm

```bash
npm install @asyra/input-system
```

### Using yarn

```bash
yarn add @asyra/input-system
```

## Usage

The default browser singleton listens for raw input. Apps define named events by
registering typed combinations, then attach and release listeners by callback
identity:

```typescript
import inputSystem, { keyMap } from '@asyra/input-system'
import { InputType, ModifierKey, PointerKey } from '@asyra/utils'

inputSystem.registry.registerKeyCombinations({
  UNDO: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyZ],
      modifiers: [ModifierKey.META]
    }
  ],
  DRAG_START: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_DOWN]
    }
  ]
})

const handleUndo = () => console.log('Undo triggered')

inputSystem.on('UNDO', handleUndo)
inputSystem.off('UNDO', handleUndo)
```

Event names and combinations are app-owned. Register each event name once for a
given registry. `off(...)` removes only the supplied listener and returns
`false` when that listener is not registered.

## Contributing

This repository is not accepting external issues or pull requests at this time.
You are welcome to fork the package and adapt it for your own application; see
the repository root README for the current contribution policy.

## License

This project is licensed under the MIT License.

## Acknowledgments

- Inspired by various input handling libraries and frameworks.
- Thanks to the open-source community for their contributions and support.
