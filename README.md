# 3D ASCII Donut - Nuxt 3 Version

This project displays a rotating 3D donut rendered using ASCII characters. It has been refactored from its original vanilla JavaScript implementation to use **Nuxt 3** and **Vue 3 (Composition API)**.

## Features

*   Smoothly rotating 3D ASCII donut.
*   Interactive mouse controls: Click and drag on the donut to rotate it manually.
*   Automatic rotation pauses during manual interaction.
*   Responsive design that adapts the character grid to window size.

## Technology Stack

*   **Nuxt 3:** A hybrid Vue framework for server-side rendering, static site generation, and more. Used here for its development environment and component-based architecture.
*   **Vue 3 (Composition API):** For building the user interface and managing component logic.
*   **TypeScript:** For improved code quality and maintainability.
*   **HTML5/CSS3:** For structure and styling.

The core 3D mathematics, ASCII mapping, and rendering logic remain similar to the original version but are now encapsulated within a Vue component.

## Project Structure (within `nuxt-app-donut/`)

*   `app.vue`: The main application Vue component that hosts the donut display. Contains global styles.
*   `components/DonutDisplay.vue`: The Vue component responsible for all aspects of the donut:
    *   3D mathematics (torus generation, rotation matrices, perspective projection).
    *   ASCII character mapping based on calculated luminance.
    *   Z-buffering for occlusion.
    *   Rendering the ASCII frame to a `<pre>` tag.
    *   Handling mouse events for interactive rotation.
    *   Managing the animation loop.
    *   Dynamically adjusting to screen/character size.
*   `nuxt.config.ts`: Configuration file for the Nuxt application.
*   `package.json`: Lists project dependencies and scripts.
*   `assets/main.css`: Can be used for global CSS (though current global styles are in `app.vue`).

## How to Run

The application is now located within the `nuxt-app-donut` directory.

1.  **Navigate to the project directory:**
    ```bash
    cd nuxt-app-donut
    ```

2.  **Install dependencies:**
    If you haven't already, or if `node_modules` is missing:
    ```bash
    npm install
    # or yarn install, or pnpm install
    ```

3.  **Start the development server:**
    ```bash
    npm run dev
    # or yarn dev, or pnpm dev
    ```
    This will typically start the application on `http://localhost:3000`.

4.  Open your browser and navigate to the provided local URL. The donut animation will start automatically.

## How It Works (Nuxt Version)

The `DonutDisplay.vue` component is the heart of the application.
*   It uses Vue's Composition API (`<script setup>`) to manage its state (like rotation angles `A` and `B`, `screenWidth`, `screenHeight`, and the `frameContent` for the ASCII output).
*   The 3D coordinates of points on a torus are calculated. These points are rotated in 3D space based on continuously changing angles (for automatic rotation) or mouse input (for manual rotation). The rotated 3D points are projected onto a 2D plane.
*   For each projected point, a luminance value is calculated based on its surface normal relative to a fixed light source. This luminance is then mapped to a specific ASCII character.
*   A Z-buffer ensures correct occlusion.
*   The `renderFrame` function constructs the ASCII string, which is then reactively bound to a `<pre>` tag in the component's template.
*   Mouse event listeners (mousedown, mousemove, mouseup, mouseleave) are attached to the window to control rotation.
*   A window resize listener updates the character grid dimensions (`screenWidth`, `screenHeight`) and the projection constant `K1`.
*   An animation loop (`setInterval`) repeatedly calls `renderFrame` to create the animation. Lifecycle hooks (`onMounted`, `onUnmounted`) manage the setup and teardown of the animation loop and event listeners.

The original direct DOM manipulation is replaced by Vue's reactive data binding and template refs where necessary (e.g., for measuring character dimensions).
