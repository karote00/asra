# Props Manager Architecture

## Overview
The `props-manager` package is responsible for managing the logical definitions and valid updates for element properties. It usually acts as an intermediary for the UI (Property Panel) to interact with the selected elements.

## Core Responsibilities
1.  **Property Definitions**: formatting and validating properties for different element types.
2.  **Update Logic**: Handling how a change in the UI (e.g., changing color in a picker) translates to a change in the `scene-tree`.

## Usage
Used primarily by the frontend UI (`apps/asyra-design`) to populate the sidebar configuration panels and apply changes back to the system.
