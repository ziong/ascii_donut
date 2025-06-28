# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a 3D ASCII donut visualization built with Nuxt 3 and Vue 3 (Composition API). The project renders a rotating 3D donut using ASCII characters with interactive mouse controls for manual rotation.

## Development Commands

The main application is located in the `nuxt-app-donut/` directory. All development commands must be run from within this directory:

```bash
cd nuxt-app-donut
```

### Essential Commands
- `npm run dev` - Start development server (configured with --host 0.0.0.0 for Replit compatibility)
- `npm run build` - Build for production
- `npm run generate` - Generate static site
- `npm run preview` - Preview production build
- `npm install` - Install dependencies

### Slash Commands
- `/dev` - Start the development server (equivalent to `cd nuxt-app-donut && npm run dev`)

## Architecture

### Core Components
- `app.vue` - Main application wrapper with global styles (black background, green monospace text)
- `components/DonutDisplay.vue` - The main donut rendering component containing all 3D math, ASCII mapping, and interaction logic

### Key Technical Details

**DonutDisplay.vue Architecture:**
- Uses Vue 3 Composition API with `<script setup>`
- Manages 3D torus geometry using rotation matrices and perspective projection  
- Implements Z-buffering for proper occlusion
- Maps calculated luminance values to ASCII characters: `.,-~:;=!*#$@`
- Handles interactive mouse controls (click and drag to rotate)
- Dynamically calculates screen dimensions based on character size
- Uses `setInterval` for animation loop with automatic rotation when not dragging

**Configuration:**
- Nuxt config includes host binding to `0.0.0.0` for development environments like Replit
- Vite server configured with WebSocket HMR and allowed hosts for hosted environments
- TypeScript enabled with Vue type checking

### State Management
The donut component manages its state internally using Vue refs:
- Rotation angles (A, B)
- Screen dimensions (screenWidth, screenHeight) 
- Mouse interaction state (isDragging, mouse coordinates)
- Frame content for ASCII output

### Styling Approach
- Global styles in `app.vue` for terminal-like appearance
- Scoped component styles in `DonutDisplay.vue` 
- Monospace font with precise line-height for character grid calculations