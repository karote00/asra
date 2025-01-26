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
npm install @asra/input-system
```

### Using yarn

```bash
yarn add @asra/input-system
```

## Usage

To get started with the Input System, follow these steps:

1. **Import the Input System**:

   ```typescript
   import InputSystem from '@asra/input-system'
   ```

2. **Define Your Key Combinations**:

   Create a record of key combinations that you want to listen for:

   ```typescript
   const combinations: Record<string, string[]> = {
     UNDO: ['Meta', 'Z'],
     REDO: ['Meta', 'Shift', 'Z'],
     SAVE: ['Control', 'S'],
     DELETE: ['Delete'],
     MOVE_UP: ['ArrowUp'],
     MOVE_DOWN: ['ArrowDown'],
     HOVER: ['LeftMouseMove'],
     DRAG_START: ['LeftMouseDown'],
     DRAG_UPDATE: ['LeftMouseDown', 'LeftMouseMove'],
     DRAG_END: ['LeftMouseUp']
   }
   ```

3. **Initialize the Input System**:

   Create an instance of the Input System with your defined combinations:

   ```typescript
   const inputSystem = new InputSystem(combinations)
   ```

4. **Attach Event Listeners**:

   Use the `on` method to listen for specific actions:

   ```typescript
   inputSystem.on('HOVER', () => console.log('Hover triggered'))
   inputSystem.on('DRAG_START', () => console.log('Drag Start'))
   inputSystem.on('DRAG_UPDATE', () => console.log('Drag Update'))
   inputSystem.on('DRAG_END', () => console.log('Drag End'))
   inputSystem.on('UNDO', () => console.log('Undo triggered'))
   inputSystem.on('REDO', () => console.log('Redo triggered'))
   ```

## Contributing

Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by various input handling libraries and frameworks.
- Thanks to the open-source community for their contributions and support.
