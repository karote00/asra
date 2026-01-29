# create-asyra-design-app

⚠️ **Experimental project. APIs and structure may change before 1.0.**

Official CLI to quickly scaffold the **Asyra Design** starter kit.  
Install, create a new project, and start designing immediately—no setup required.

---

## Features

- Installs the latest stable `asyra-design` with all dependencies (`@asyra/core`, `@asyra/renderer`)  
- Provides a ready-to-run template project  
- Perfect for beginners or teams wanting to quickly prototype with Asyra  
- Safe and stable: isolated from main UI development branch

---

## Getting Started

### Prerequisites

- Node.js >= 18  
- Yarn

### Installation

Install globally:

```bash
npm install -g create-asyra-design-app
# or
yarn global add create-asyra-design-app
```

### Create a New Project

```bash
yarn create asyra-design my-project
# or
npx create-asyra-design-app my-project
```

This will:

1. Create the `my-project` folder  
2. Install the official stable `asyra-design` package  
3. Copy the starter template with a ready-to-run index file  

### Start the Project

```bash
cd my-project
yarn start
```

Now you have a fully working Asyra Design environment, ready to experiment and create.

---

## Updating the Official Starter

- The CLI always installs the latest stable version of `asyra-design`  
- To update your project to the newest stable version:

```bash
yarn upgrade asyra-design
```

---

## Contributing

- This repo only manages the CLI and the official starter template  
- Main UI development happens in the `asyra-design` repo  
- To contribute to the starter template, open a PR here

---

## License

MIT
