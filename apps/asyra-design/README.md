# Asyra Design

**Asyra Design** is the official UI product built on top of **Asyra Core**.  
It provides a ready-to-use design environment with canvas, elements, and interaction support.

---

## Features

- Full-featured design canvas  
- Scene-tree and selection management  
- Reactive data flow using `ui-context` and signals  
- Undo/redo fully integrated with core changes  
- Default renderer powered by Pixi.js  
- Ready for extension and customization

---

## Getting Started

### Prerequisites

- Node.js >= 18  
- Yarn

### Installation

Clone the repository:

---bash
git clone https://github.com/karote00/asyra.git
cd asyra/apps/asyra-design
yarn install
---

### Start the Project

---bash
yarn start
---

This will launch a development server and open the Asyra Design UI.

---

## Project Structure

- `src/` — main UI source code  
- `components/` — reusable UI components  
- `providers/` — app-level subscriptions/derived reads from core and `ui-context` properties  
- `renderer/` — interface to render engine (Pixi.js by default)  
- `utils/` — shared utility functions

---

## Contributing

- The main development happens in the **Asyra Core** and **Asyra UI** repos  
- Pull requests for UI improvements and bug fixes are welcome  
- Please make sure your changes do not break the default canvas or core integrations

---

## License

MIT
