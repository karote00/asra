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

Construction is environment-neutral: importing the package or creating an
`InputSystem` does not read browser globals or attach listeners. Direct browser
consumers explicitly select a keyboard host and optional pointer target, define
named events, then attach and release normalized listeners by callback identity:

```typescript
import inputSystem, { keyMap } from '@asyra/input-system'
import { InputType, ModifierKey, PointerKey } from '@asyra/utils'

const canvas = document.querySelector('canvas')
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Expected a canvas input target')
}

inputSystem.attachBrowserHost(window, canvas)

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

// Remove the keyboard, pointer, and wheel listeners owned by this instance.
inputSystem.detachBrowserHost()
```

Event names and combinations are app-owned. Register each event name once for a
given registry. `off(...)` removes only the supplied listener and returns
`false` when that listener is not registered.

`switchWatchedElement(element)` moves pointer ownership to that element and
uses its owning `Window` for keyboard events. `reset()` clears transient input
state while preserving the current browser attachment; `dispose()` detaches the
browser host and clears transient state. The default Core visual startup already
uses the existing watched-element event route, so apps using `@asyra/core` do not
need to attach the default singleton separately.

## Contributing

This repository is not accepting external issues or pull requests at this time.
You are welcome to fork the package and adapt it for your own application; see
the repository root README for the current contribution policy.

## License

This project is licensed under the MIT License.

## Release support

The `@asyra/input-system` `0.2.5` ESM artifact supports Node.js 24.x. Its public
entrypoint can be imported and an `InputSystem` can be constructed without DOM
globals; browser input still requires explicit host attachment. This does not
declare a public Headless Core runtime. Use only package-root exports. See the
[Framework release support contract](../../docs/ai/framework/RELEASE_SUPPORT.md).

## Acknowledgments

- Inspired by various input handling libraries and frameworks.
- Thanks to the open-source community for their contributions and support.
