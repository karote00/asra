# UI Context Architecture

## Overview
The `ui-context` package manages state specific to the Editor's user interface (the chrome around the canvas), such as panels, modals, and layout visibility.

## Distinction
*   `system-context`: State of the *interaction* (tools, mouse, canvas specific).
*   `ui-context`: State of the *application UI* (is the generic sidebar open? is the export modal showing?).

## Core Responsibilities
1.  **Stores**: Uses stores (possibly Zustand or Valtio based on `stores` dir) to manage UI state.
2.  **Globals**: Provides global access to trigger UI changes from deep within the application logic if necessary.
