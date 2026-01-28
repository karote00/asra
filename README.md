# Asyra

> **Asyra** — An information modeling framework for building interactive design applications, by defining yourself.

## Core Vision

- **Information Model First**: Defines what an information model should contain for interactive design apps.  
- **Framework for Product Extension**: Provides modular building blocks so developers can define their own interactive products.  
- **Modular and Customizable**: Developers have full control over how modules are combined and extended.

## Core Modules

1. **Event Flow**: Decouples all repos; the foundation of modular communication.  
2. **Scene Tree**: Represents the structured information model for interactive elements.  
3. **Renderer**: Processes data context changes and calls the render engine to display content.  
4. **Core**: Unified API entry point for system-level communication.  
5. **Interaction Core + Input System**: Supports combo keys, user-defined shortcuts, and rules/decisions for context-specific actions.  
6. **UI Context**: Processes data context changes specifically for UI rendering; can be replaced with custom modules if desired.  
7. **UI**: Fully customizable presentation layer; developers choose how to display data.  
8. **Undo Behaviours**: Immutable module to ensure system stability.  
9. **CRDT**: Immutable core with optional extensibility via registry objects.  

> There are over a dozen modular systems that can be assembled and extended to create new interactive products.  
> The framework is intentionally conceptual, leaving full control to developers to define their own scene-tree, event flows, and system contexts.

## Architecture Overview

---
mermaid
flowchart TD
    %% Core modules
    EventFlow["Event Flow"]
    SceneTree["Scene Tree"]
    Renderer["Renderer"]
    CoreAPI["Core API"]
    Interaction["Interaction Core + Input System"]
    UIContext["UI Context"]
    UI["UI"]
    Undo["Undo Behaviours (Immutable)"]
    CRDT["CRDT (Extensible Registry)"]

    %% Data / control flows
    EventFlow --> SceneTree
    SceneTree --> Renderer
    SceneTree --> UIContext
    Renderer --> UI
    UIContext --> UI
    Interaction --> UI
    CoreAPI --> EventFlow
    CoreAPI --> SceneTree
    Undo --> EventFlow
    CRDT --> EventFlow

    %% Notes
    classDef immutable fill:#f9f,stroke:#333,stroke-width:1px;
    class Undo,CRDT immutable;
---

> This diagram is conceptual. It shows how Asyra's core modules interact and the main data flow paths. Developers are free to define their own scene-tree, event flows, and system contexts.

## Modular Assembly Overview

---
mermaid
flowchart TD
    %% Product Example
    Product["Custom Interactive Product"]

    %% Core Modules
    EventFlow["Event Flow"]
    SceneTree["Scene Tree"]
    Renderer["Renderer"]
    CoreAPI["Core API"]
    Interaction["Interaction Core + Input System"]
    UIContext["UI Context"]
    UI["UI"]
    Undo["Undo Behaviours (Immutable)"]
    CRDT["CRDT (Extensible Registry)"]
    ExtraModules["Other Optional Modules"]

    %% Assembly Paths
    Product --> EventFlow
    Product --> SceneTree
    Product --> Renderer
    Product --> CoreAPI
    Product --> Interaction
    Product --> UIContext
    Product --> UI
    Product --> Undo
    Product --> CRDT
    Product --> ExtraModules

    %% Notes
    classDef immutable fill:#f9f,stroke:#333,stroke-width:1px;
    class Undo,CRDT immutable;
---

> This diagram illustrates how developers can assemble Asyra's modular systems to create a custom interactive product.  
> Each module can be combined or extended according to the product's needs. Immutable modules (Undo Behaviours, CRDT) provide system stability while optional modules allow full customization.



## 🤝 Contribution Policy

Asyra is an open-source project and is publicly available for reference, learning, and use.

However, this repository is **not accepting external contributions** at this time.
This includes pull requests, issues, and other forms of direct contribution.

The codebase is intentionally curated to serve as a **cohesive reference implementation**
for Communication-Driven Development (CDD) and AI-native workflows.

You are welcome to fork the project and adapt it for your own needs.


---
> Asyra is the evolution of Asra — consolidating previous experiences into a new, long-term vision.


## License

MIT
