# 3D ASCII Donut

This project displays a rotating 3D donut rendered using ASCII characters in an HTML canvas. It's implemented purely with vanilla JavaScript, HTML5, and CSS, with no external dependencies or build tools required.

## Features

*   Smoothly rotating 3D ASCII donut.
*   Interactive mouse controls: Click and drag on the donut to rotate it manually.
*   Automatic rotation pauses during manual interaction.
*   Lightweight and dependency-free.

## How to Run

1.  Clone or download the repository/files (`index.html`, `style.css`, `donut.js`, `main.js`).
2.  Open the `index.html` file in any modern web browser (e.g., Chrome, Firefox, Safari, Edge).

The donut animation will start automatically.

## Technology Stack

*   **HTML5:** For the basic structure and the `<canvas>` element.
*   **CSS3:** For styling the page and canvas.
*   **Vanilla JavaScript:** For all the logic, including:
    *   3D mathematics (torus generation, rotation matrices, perspective projection).
    *   ASCII character mapping based on calculated luminance.
    *   Canvas rendering and animation loop (`requestAnimationFrame`).
    *   Mouse event handling for interactive rotation.

## File Structure

*   `index.html`: The main HTML file that you open in the browser.
*   `style.css`: Contains styles for the page layout and canvas appearance.
*   `donut.js`: The core logic for the donut's 3D calculations and ASCII character generation.
*   `main.js`: Handles the canvas setup, animation, user input (mouse dragging), and orchestrates the rendering process by calling functions from `donut.js`.

## How It Works

The `donut.js` script calculates the 3D coordinates of points on a torus (the donut shape). These points are then rotated in 3D space based on continuously changing angles (for automatic rotation) or mouse input (for manual rotation). The rotated 3D points are projected onto a 2D plane.

For each point, a luminance value is calculated based on its surface normal relative to a fixed light source. This luminance is then mapped to a specific ASCII character from a predefined set (darker characters for less illuminated areas, brighter for more illuminated ones).

A Z-buffer is used to ensure correct occlusion (parts of the donut closer to the viewer hide parts that are further away).

The `main.js` script takes this 2D array of characters and draws them onto the HTML canvas, character by character, in an animation loop, creating the illusion of a spinning 3D object. Mouse listeners on the canvas allow the user to override the automatic rotation and control it directly.
