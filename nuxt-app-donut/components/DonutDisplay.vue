<template>
  <div class="donut-container">
    <pre ref="donutPreElement" class="donut-pre-tag">{{ frameContent }}</pre>
    <div class="zoom-slider-container">
      <input 
        type="range" 
        class="zoom-slider" 
        :min="0.05" 
        :max="5" 
        :step="0.1" 
        :value="zoomFactor"
        @input="handleSliderZoom"
      />
      <div class="zoom-labels">
        <span class="zoom-label zoom-max">5x</span>
        <span class="zoom-label zoom-current">{{ zoomFactor.toFixed(1) }}x</span>
        <span class="zoom-label zoom-min">0.05x</span>
      </div>
    </div>

    <!-- X-Axis Speed Slider -->
    <div class="speed-slider-container x-speed">
      <input 
        type="range" 
        class="speed-slider" 
        :min="0" 
        :max="1" 
        :step="0.01" 
        :value="rotationSpeedX"
        @input="handleXSpeedSlider"
      />
      <div class="speed-labels">
        <span class="speed-label">X-SPEED</span>
        <span class="speed-value">{{ rotationSpeedX.toFixed(2) }}</span>
      </div>
    </div>

    <!-- Y-Axis Speed Slider -->
    <div class="speed-slider-container y-speed">
      <input 
        type="range" 
        class="speed-slider" 
        :min="0" 
        :max="1" 
        :step="0.01" 
        :value="rotationSpeedY"
        @input="handleYSpeedSlider"
      />
      <div class="speed-labels">
        <span class="speed-label">Y-SPEED</span>
        <span class="speed-value">{{ rotationSpeedY.toFixed(2) }}</span>
      </div>
    </div>

    <!-- Font Size Slider -->
    <div class="font-slider-container">
      <input 
        type="range" 
        class="font-slider" 
        :min="4" 
        :max="30" 
        :step="1" 
        :value="fontSize"
        @input="handleFontSizeSlider"
      />
      <div class="font-labels">
        <span class="font-label">FONT</span>
        <span class="font-value">{{ fontSize }}px</span>
      </div>
    </div>

    <!-- Pause/Resume Button -->
    <div class="pause-button-container">
      <button class="pause-button" @click="togglePause">
        <span v-if="isPaused">▶</span>
        <span v-else>⏸</span>
      </button>
    </div>
    
    <!-- Status Table -->
    <div class="status-table">
      <div class="status-header">DONUT STATUS</div>
      <table class="status-grid">
        <tbody>
          <tr>
            <td class="status-label">FPS:</td>
            <td class="status-value">{{ FPS }}</td>
          </tr>
          <tr>
            <td class="status-label">X-AXIS:</td>
            <td class="status-value">{{ rotationSpeedX.toFixed(3) }} rad/s</td>
          </tr>
          <tr>
            <td class="status-label">Y-AXIS:</td>
            <td class="status-value">{{ rotationSpeedY.toFixed(3) }} rad/s</td>
          </tr>
          <tr>
            <td class="status-label">STATUS:</td>
            <td class="status-value">{{ isPaused ? 'PAUSED' : 'ROTATING' }}</td>
          </tr>
          <tr>
            <td class="status-label">ZOOM:</td>
            <td class="status-value">{{ (zoomFactor * 100).toFixed(0) }}%</td>
          </tr>
          <tr>
            <td class="status-label">FONT:</td>
            <td class="status-value">{{ fontSize }}px</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Key Bindings Table -->
    <div class="keybindings-table">
      <div class="keybindings-header">KEYS</div>
      <table class="keybindings-grid">
        <tbody>
          <tr>
            <td class="key-label">SPACE:</td>
            <td class="key-description">PAUSE/RESUME</td>
          </tr>
          <tr>
            <td class="key-label">+/=:</td>
            <td class="key-description">ZOOM IN</td>
          </tr>
          <tr>
            <td class="key-label">-/_:</td>
            <td class="key-description">ZOOM OUT</td>
          </tr>
          <tr>
            <td class="key-label">[:</td>
            <td class="key-description">FONT SIZE -</td>
          </tr>
          <tr>
            <td class="key-label">]:</td>
            <td class="key-description">FONT SIZE +</td>
          </tr>
          <tr>
            <td class="key-label">MOUSE:</td>
            <td class="key-description">DRAG TO ROTATE</td>
          </tr>
          <tr>
            <td class="key-label">WHEEL:</td>
            <td class="key-description">ZOOM IN/OUT</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

const donutPreElement = ref<HTMLPreElement | null>(null);
const frameContent = ref<string>('');

// State variables from donut.js
const A = ref<number>(0); // Rotation angle A
const B = ref<number>(0); // Rotation angle B
const screenWidth = ref<number>(80); // Default width in characters
const screenHeight = ref<number>(40); // Default height in characters
let K1 = ref<number>(0); // Projection constant K1
const zoomFactor = ref<number>(0.25); // Zoom factor (1 = normal, >1 = zoomed in, <1 = zoomed out)
const fontSize = ref<number>(15); // Font size in pixels

// Mouse dragging state
const isDragging = ref<boolean>(false);
const lastMouseX = ref<number>(0);
const lastMouseY = ref<number>(0);

// Animation timer
let renderInterval: ReturnType<typeof setInterval> | null = null;

// Font size recalculation flag
const isRecalculating = ref<boolean>(false);

// Pause state for rotation
const isPaused = ref<boolean>(false);

// Torus geometry constants (can be tweaked)
const R1 = 1;
const R2 = 2;
const K2 = 5;

// Default rotation speeds (consistent between server and client)
const defaultSpeedX = 0.5; // Default X-axis rotation speed
const defaultSpeedY = 0.3; // Default Y-axis rotation speed

// Display variables for status table
const rotationSpeedX = ref<number>(defaultSpeedX);
const rotationSpeedY = ref<number>(defaultSpeedY);

// Constants
const FPS = ref<number>(20); // Make FPS reactive for template binding

// Reactive rotation speeds for actual calculations
const ROTATION_SPEED_A = ref<number>(defaultSpeedX / FPS.value); // Convert rad/s to rad/frame for A
const ROTATION_SPEED_B = ref<number>(defaultSpeedY / FPS.value); // Convert rad/s to rad/frame for B

const getCharDimensions = (): { charWidth: number; charHeight: number } => {
  if (!donutPreElement.value) return { charWidth: 10, charHeight: 10 }; // Fallback

  const temp = document.createElement("span");
  temp.innerHTML = "X"; // Use a common character
  if (donutPreElement.value) {
    const computedStyle = getComputedStyle(donutPreElement.value);
    temp.style.fontFamily = computedStyle.fontFamily;
    temp.style.fontSize = `${fontSize?.value || 8}px`;
    // temp.style.lineHeight = computedStyle.lineHeight; // Important for height
  }
  temp.style.position = "absolute";
  temp.style.visibility = "hidden";
  document.body.appendChild(temp);
  // Ensure line-height is considered or use offsetHeight for block characters
  const charWidth = temp.offsetWidth;
  // Use offsetHeight for more reliable height, especially with line-height
  const charHeight = temp.offsetHeight || parseInt(temp.style.fontSize) || 10;
  document.body.removeChild(temp);
  return { charWidth, charHeight };
};

const updateDimensions = () => {
  if (!process.client || typeof window === 'undefined' || !donutPreElement.value) return;

  const { charWidth, charHeight } = getCharDimensions();

  if (charWidth === 0 || charHeight === 0) {
    console.warn("Character dimensions are zero. Using fallback screen size.");
    screenWidth.value = 80;
    screenHeight.value = 40;
  } else {
    // Add 1px minimum spacing to character dimensions for screen calculation
    const effectiveCharWidth = charWidth + 1;  // 1px letter-spacing
    const effectiveCharHeight = charHeight + 1; // 1px line spacing
    
    screenWidth.value = Math.floor(window.innerWidth / effectiveCharWidth);
    screenHeight.value = Math.floor(window.innerHeight / effectiveCharHeight);
  }

  K1.value = screenWidth.value * K2 * 3 / (8 * (R1 + R2)) * zoomFactor.value;
  console.log(`Screen dimensions: ${screenWidth.value}x${screenHeight.value} chars. K1: ${K1.value}, Zoom: ${zoomFactor.value}`);
};


const renderFrame = () => {
  try {
    // Only run on client side
    if (!process.client) {
      return;
    }
    
    // Skip rendering during font size recalculation
    if (isRecalculating.value) {
      return;
    }
    
    if (!donutPreElement.value || K1.value === 0) { // Ensure K1 is initialized
      frameContent.value = "Initializing dimensions or K1 is zero...";
      return;
    }
    
    // Validate screen dimensions
    if (screenWidth.value <= 0 || screenHeight.value <= 0) {
      frameContent.value = "Invalid screen dimensions...";
      return;
    }

  const b: number[] = []; // Z-buffer
  const z: string[] = []; // Character buffer

  const currentA = A.value;
  const currentB = B.value;

  const bufferSize = screenWidth.value * screenHeight.value;
  if (bufferSize <= 0) {
    frameContent.value = "Window too small or error in dimension calculation.";
    return;
  }

  for (let k = 0; k < bufferSize; k++) {
    b[k] = 0;
    z[k] = ' ';
  }

  const cA = Math.cos(currentA), sA = Math.sin(currentA);
  const cB = Math.cos(currentB), sB = Math.sin(currentB);

  for (let theta = 0; theta < 2 * Math.PI; theta += 0.07) {
    const ct = Math.cos(theta), st = Math.sin(theta);
    for (let phi = 0; phi < 2 * Math.PI; phi += 0.02) {
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const x = R2 + R1 * ct;
      const y = R1 * st;
      const x_ = x * (cB * cp + sA * sB * sp) - y * cA * sB;
      const y_ = x * (sB * cp - sA * cB * sp) + y * cA * cB;
      const z_ = K2 + cA * x * sp + y * sA;
      const ooz = 1 / z_;

      const xp = Math.floor(screenWidth.value / 2 + K1.value * ooz * x_);
      const yp = Math.floor(screenHeight.value / 2 - K1.value * ooz * y_);

      const L1 = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp);
      if (L1 > 0) {
        const idx = xp + screenWidth.value * yp;
        if (idx >= 0 && idx < bufferSize && ooz > b[idx]) {
          b[idx] = ooz;
          const luminance_index = Math.floor(L1 * 8);
          z[idx] = ".,-~:;=!*#$@"[Math.min(Math.max(luminance_index, 0), 11)];
        }
      }
    }
  }

  let frame = "";
  for (let k = 0; k < bufferSize; k++) {
    frame += (k % screenWidth.value ? z[k] : '\n');
  }
  frameContent.value = frame;

  // Only auto-rotate if not dragging and not paused
  if (!isDragging.value && !isPaused.value) {
    A.value += ROTATION_SPEED_A.value;
    B.value += ROTATION_SPEED_B.value;
  }
  
    // Update rotation speed display based on current state
    // Note: rotationSpeedX and rotationSpeedY are now controlled by sliders
    // and represent the actual display values, no need to modify them here
  } catch (error) {
    console.error('Error in renderFrame:', error);
    frameContent.value = "Rendering error occurred...";
  }
};

// Touch and Mouse event handlers
const handlePointerStart = (e: PointerEvent | MouseEvent) => {
  isDragging.value = true;
  lastMouseX.value = e.clientX;
  lastMouseY.value = e.clientY;
  if (donutPreElement.value) {
      donutPreElement.value.style.cursor = 'grabbing';
  }
  
  // Prevent default to avoid conflicts with touch gestures
  e.preventDefault();
};

const handlePointerMove = (e: PointerEvent | MouseEvent) => {
  if (isDragging.value) {
    const deltaX = e.clientX - lastMouseX.value;
    const deltaY = e.clientY - lastMouseY.value;
    
    // Adjust sensitivity for touch vs mouse
    const sensitivity = e.pointerType === 'touch' ? 300 : 200;
    
    B.value += deltaX / sensitivity;
    A.value += deltaY / sensitivity;
    lastMouseX.value = e.clientX;
    lastMouseY.value = e.clientY;
  }
};

const handlePointerEnd = () => {
  if (isDragging.value) {
    isDragging.value = false;
    if (donutPreElement.value) {
        donutPreElement.value.style.cursor = 'grab';
    }
  }
};

// Legacy mouse event handlers for backwards compatibility
const handleMouseDown = (e: MouseEvent) => handlePointerStart(e);
const handleMouseMove = (e: MouseEvent) => handlePointerMove(e);
const handleMouseUpOrLeave = () => handlePointerEnd();

// Touch event handlers
const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    const pointerEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      pointerType: 'touch',
      preventDefault: () => e.preventDefault()
    } as PointerEvent;
    handlePointerStart(pointerEvent);
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 1 && isDragging.value) {
    const touch = e.touches[0];
    const pointerEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      pointerType: 'touch',
      preventDefault: () => e.preventDefault()
    } as PointerEvent;
    handlePointerMove(pointerEvent);
  }
};

const handleTouchEnd = () => {
  handlePointerEnd();
};


// Window resize handler
const handleResize = () => {
  updateDimensions();
  // nextTick ensures DOM is updated before re-render, if necessary.
  // Direct call to renderFrame should be fine here as well.
  nextTick(() => {
    renderFrame();
  });
};

// Font size recalculation with screen clear
const recalculateWithNewFontSize = () => {
  isRecalculating.value = true;
  frameContent.value = ''; // Clear screen immediately
  
  // Wait for DOM to update with new font size, then recalculate
  nextTick(() => {
    setTimeout(() => {
      updateDimensions(); // Recalculate with new font size
      isRecalculating.value = false; // Resume rendering
    }, 100); // Allow time for font rendering
  });
};

// Keyboard event handlers for zoom and font size
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === '+' || e.key === '=') {
    zoomFactor.value = Math.min(zoomFactor.value * 1.1, 5); // Max zoom 5x
    updateDimensions();
  } else if (e.key === '-' || e.key === '_') {
    zoomFactor.value = Math.max(zoomFactor.value / 1.1, 0.05); // Min zoom 0.05x
    updateDimensions();
  } else if (e.key === '[') {
    fontSize.value = Math.max(fontSize.value - 1, 4); // Min font size 4px
    recalculateWithNewFontSize();
  } else if (e.key === ']') {
    fontSize.value = Math.min(fontSize.value + 1, 30); // Max font size 30px
    recalculateWithNewFontSize();
  } else if (e.key === ' ') {
    e.preventDefault(); // Prevent page scrolling
    isPaused.value = !isPaused.value; // Toggle pause state
  }
};

// Mouse wheel event handler for zoom
const handleWheel = (e: WheelEvent) => {
  e.preventDefault(); // Prevent page scrolling
  const zoomDirection = e.deltaY > 0 ? -1 : 1; // Negative deltaY = zoom in, positive = zoom out
  const zoomSpeed = 1.1;
  
  if (zoomDirection > 0) {
    zoomFactor.value = Math.min(zoomFactor.value * zoomSpeed, 5); // Max zoom 5x
  } else {
    zoomFactor.value = Math.max(zoomFactor.value / zoomSpeed, 0.05); // Min zoom 0.05x
  }
  updateDimensions();
};

// Slider zoom handler
const handleSliderZoom = (event: Event) => {
  try {
    const target = event.target as HTMLInputElement;
    const newZoom = parseFloat(target.value);
    if (isNaN(newZoom) || newZoom < 0.05 || newZoom > 5) return;
    
    zoomFactor.value = newZoom;
    updateDimensions();
  } catch (error) {
    console.error('Error handling zoom slider:', error);
  }
};

// X-axis speed slider handler
const handleXSpeedSlider = (event: Event) => {
  try {
    const target = event.target as HTMLInputElement;
    const newSpeed = parseFloat(target.value);
    if (isNaN(newSpeed) || newSpeed < 0 || newSpeed > 1) return;
    
    rotationSpeedX.value = newSpeed;
    // Update the actual rotation speed constant
    ROTATION_SPEED_A.value = newSpeed / FPS.value;
  } catch (error) {
    console.error('Error handling X-axis speed slider:', error);
  }
};

// Y-axis speed slider handler
const handleYSpeedSlider = (event: Event) => {
  try {
    const target = event.target as HTMLInputElement;
    const newSpeed = parseFloat(target.value);
    if (isNaN(newSpeed) || newSpeed < 0 || newSpeed > 1) return;
    
    rotationSpeedY.value = newSpeed;
    // Update the actual rotation speed constant
    ROTATION_SPEED_B.value = newSpeed / FPS.value;
  } catch (error) {
    console.error('Error handling Y-axis speed slider:', error);
  }
};

// Font size slider handler
const handleFontSizeSlider = (event: Event) => {
  try {
    const target = event.target as HTMLInputElement;
    const newSize = parseInt(target.value);
    if (isNaN(newSize) || newSize < 4 || newSize > 30) return;
    
    fontSize.value = newSize;
    recalculateWithNewFontSize();
  } catch (error) {
    console.error('Error handling font size slider:', error);
  }
};

// Toggle pause function for button
const togglePause = () => {
  try {
    isPaused.value = !isPaused.value;
  } catch (error) {
    console.error('Error toggling pause state:', error);
  }
};

onMounted(() => {
  // Generate random rotation speeds only on client side to prevent hydration mismatch
  if (process.client) {
    const randomSpeedX = Math.random() * 0.9 + 0.1; // X-axis rotation speed (0.1 to 1 rad/s)
    const randomSpeedY = Math.random() * 0.9 + 0.1; // Y-axis rotation speed (0.1 to 1 rad/s)
    
    // Update reactive values with random speeds
    rotationSpeedX.value = randomSpeedX;
    rotationSpeedY.value = randomSpeedY;
    ROTATION_SPEED_A.value = randomSpeedX / FPS.value;
    ROTATION_SPEED_B.value = randomSpeedY / FPS.value;
  }

  // Attach to window for global mouse/touch capture and resize
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUpOrLeave);
  window.addEventListener('mouseleave', handleMouseUpOrLeave);
  
  // Touch event listeners
  window.addEventListener('touchstart', handleTouchStart, { passive: false });
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd, { passive: false });
  window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  
  // Other event listeners
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('wheel', handleWheel, { passive: false });

  // Initial setup
  // nextTick ensures that the preTag is available for getCharDimensions
  nextTick(() => {
    updateDimensions(); // Calculate initial dimensions and K1
    renderFrame(); // Initial render
    if (renderInterval === null) { // Avoid multiple intervals if onMounted called multiple times (HMR)
        renderInterval = setInterval(renderFrame, 50);
    }
  });
});

onUnmounted(() => {
  if (renderInterval !== null) {
    clearInterval(renderInterval);
    renderInterval = null;
  }
  // Remove mouse event listeners
  window.removeEventListener('mousedown', handleMouseDown);
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUpOrLeave);
  window.removeEventListener('mouseleave', handleMouseUpOrLeave);
  
  // Remove touch event listeners
  window.removeEventListener('touchstart', handleTouchStart);
  window.removeEventListener('touchmove', handleTouchMove);
  window.removeEventListener('touchend', handleTouchEnd);
  window.removeEventListener('touchcancel', handleTouchEnd);
  
  // Remove other event listeners
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('wheel', handleWheel);
  // Restore cursor if component is unmounted while dragging
  if (donutPreElement.value) {
      donutPreElement.value.style.cursor = 'default';
  }
});

</script>

<style scoped>
.donut-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.donut-pre-tag {
  font-size: v-bind('fontSize + "px"');
  line-height: 1.125;
  letter-spacing: 1px;
  width: 100%;
  height: 100%;
  text-align: left;
  white-space: pre;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: grab;
}

/* Responsive Design Variables */
:root {
  --control-width: 220px;
  --control-spacing: 50px;
  --control-padding: 20px;
  --touch-target-size: 44px;
  --slider-width: 120px;
  --font-size-small: 10px;
  --font-size-medium: 12px;
  --font-size-large: 14px;
}

/* Common slider container styles - Desktop First */
.zoom-slider-container,
.speed-slider-container,
.font-slider-container {
  position: absolute;
  right: var(--control-padding);
  display: flex;
  flex-direction: row;
  align-items: center;
  z-index: 1000;
  width: var(--control-width);
  height: auto;
  pointer-events: auto;
  transition: all 0.3s ease;
}

.zoom-slider-container {
  top: 520px;
}

.speed-slider-container.x-speed {
  top: 570px;
}

.speed-slider-container.y-speed {
  top: 620px;
}

.font-slider-container {
  top: 670px;
}

/* Tablet Styles (768px - 1200px) */
@media screen and (max-width: 1200px) and (min-width: 768px) {
  :root {
    --control-width: 180px;
    --control-spacing: 40px;
    --control-padding: 15px;
    --slider-width: 100px;
    --font-size-small: 9px;
    --font-size-medium: 11px;
    --font-size-large: 13px;
  }
  
  .zoom-slider-container { top: 480px; }
  .speed-slider-container.x-speed { top: 520px; }
  .speed-slider-container.y-speed { top: 560px; }
  .font-slider-container { top: 600px; }
}

/* Mobile Landscape (480px - 768px) */
@media screen and (max-width: 768px) and (min-width: 480px) {
  :root {
    --control-width: 100%;
    --control-spacing: 10px;
    --control-padding: 10px;
    --slider-width: 150px;
    --touch-target-size: 48px;
  }
  
  .zoom-slider-container,
  .speed-slider-container,
  .font-slider-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    background: rgba(0, 0, 0, 0.9);
    border-top: 2px solid #00ff00;
    border-radius: 12px 12px 0 0;
    padding: 15px;
    backdrop-filter: blur(4px);
    justify-content: center;
    transform: translateY(100%);
    animation: slideUp 0.3s ease forwards;
  }
  
  @keyframes slideUp {
    to { transform: translateY(0); }
  }
  
  .zoom-slider-container { bottom: 200px; }
  .speed-slider-container.x-speed { bottom: 150px; }
  .speed-slider-container.y-speed { bottom: 100px; }
  .font-slider-container { bottom: 50px; }
}

/* Mobile Portrait (<480px) */
@media screen and (max-width: 480px) {
  :root {
    --control-width: 100%;
    --control-spacing: 8px;
    --control-padding: 8px;
    --slider-width: 120px;
    --touch-target-size: 50px;
    --font-size-small: 8px;
    --font-size-medium: 10px;
    --font-size-large: 12px;
  }
  
  .zoom-slider-container,
  .speed-slider-container,
  .font-slider-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    background: rgba(0, 0, 0, 0.95);
    border-top: 2px solid #00ff00;
    border-radius: 16px 16px 0 0;
    padding: 12px;
    backdrop-filter: blur(6px);
    justify-content: center;
    flex-direction: column;
    gap: 10px;
    transform: translateY(100%);
    animation: slideUp 0.3s ease forwards;
  }
  
  .zoom-slider-container { bottom: 160px; }
  .speed-slider-container.x-speed { bottom: 120px; }
  .speed-slider-container.y-speed { bottom: 80px; }
  .font-slider-container { bottom: 40px; }
}

/* Pause Button Container - Responsive */
.pause-button-container {
  position: absolute;
  top: 720px;
  right: var(--control-padding);
  width: var(--control-width);
  z-index: 1000;
  pointer-events: auto;
  display: flex;
  justify-content: center;
  transition: all 0.3s ease;
}

.pause-button {
  width: var(--slider-width);
  height: 40px;
  min-height: var(--touch-target-size);
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #00ff00;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #00ff00;
  text-shadow: 0 0 3px #00ff00;
  backdrop-filter: blur(2px);
  transition: all 0.2s ease;
  font-family: 'Courier New', monospace;
}

.pause-button:hover {
  background: rgba(0, 255, 0, 0.1);
  border-color: #44ff44;
  color: #44ff44;
  transform: scale(1.02);
}

.pause-button:active {
  transform: scale(0.98);
}

/* Tablet adjustments for pause button */
@media screen and (max-width: 1200px) and (min-width: 768px) {
  .pause-button-container {
    top: 640px;
  }
}

/* Mobile adjustments for pause button */
@media screen and (max-width: 768px) {
  .pause-button-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    background: rgba(0, 0, 0, 0.9);
    border-top: 2px solid #00ff00;
    border-radius: 12px 12px 0 0;
    padding: 15px;
    backdrop-filter: blur(4px);
    transform: translateY(100%);
    animation: slideUp 0.3s ease forwards;
  }
  
  .pause-button {
    width: 200px;
    height: var(--touch-target-size);
    font-size: 20px;
    border-radius: 8px;
  }
}

@media screen and (max-width: 480px) {
  .pause-button-container {
    padding: 12px;
    border-radius: 16px 16px 0 0;
  }
  
  .pause-button {
    width: 160px;
    height: var(--touch-target-size);
    font-size: 22px;
  }
}

.zoom-slider {
  width: 120px;
  height: 20px;
  background: #333;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 10px;
  border: 1px solid #00ff00;
}

/* Webkit browsers (Chrome, Safari) - Common styles */
.zoom-slider::-webkit-slider-track,
.speed-slider::-webkit-slider-track,
.font-slider::-webkit-slider-track {
  width: 120px;
  height: 4px;
  background: #333;
  border-radius: 2px;
}

.zoom-slider::-webkit-slider-thumb,
.speed-slider::-webkit-slider-thumb,
.font-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  background: #00ff00;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #00aa00;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 255, 0, 0.3);
}

.zoom-slider::-webkit-slider-thumb:hover,
.speed-slider::-webkit-slider-thumb:hover,
.font-slider::-webkit-slider-thumb:hover {
  background: #44ff44;
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 255, 0, 0.5);
}

/* Firefox - Common styles */
.zoom-slider::-moz-range-track,
.speed-slider::-moz-range-track,
.font-slider::-moz-range-track {
  width: 120px;
  height: 4px;
  background: #333;
  border-radius: 2px;
  border: none;
}

.zoom-slider::-moz-range-thumb,
.speed-slider::-moz-range-thumb,
.font-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  background: #00ff00;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #00aa00;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 255, 0, 0.3);
}

/* Mobile touch adjustments for thumbs */
@media screen and (max-width: 768px) {
  .zoom-slider::-webkit-slider-thumb,
  .speed-slider::-webkit-slider-thumb,
  .font-slider::-webkit-slider-thumb {
    width: 32px;
    height: 32px;
    border: 3px solid #00aa00;
  }
  
  .zoom-slider::-moz-range-thumb,
  .speed-slider::-moz-range-thumb,
  .font-slider::-moz-range-thumb {
    width: 32px;
    height: 32px;
    border: 3px solid #00aa00;
  }
}

.zoom-label {
  color: #00ff00;
  text-shadow: 0 0 3px #00ff00;
  white-space: nowrap;
}

.zoom-current {
  font-weight: bold;
  color: #44ff44;
}

/* Common slider styles - Responsive */
.zoom-slider,
.speed-slider,
.font-slider {
  width: var(--slider-width);
  height: 24px;
  background: #333;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 12px;
  border: 2px solid #00ff00;
  transition: all 0.2s ease;
}

/* Touch-friendly adjustments for mobile */
@media screen and (max-width: 768px) {
  .zoom-slider,
  .speed-slider,
  .font-slider {
    height: 32px;
    border-radius: 16px;
  }
}

/* Common label styles - Responsive */
.zoom-labels,
.speed-labels,
.font-labels {
  display: flex;
  align-items: center;
  margin-left: 8px;
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-small);
  transition: all 0.2s ease;
}

.zoom-labels {
  flex-direction: row;
  gap: 5px;
}

.speed-labels,
.font-labels {
  flex-direction: column;
}

.speed-label,
.font-label {
  color: #00ff00;
  text-shadow: 0 0 3px #00ff00;
  white-space: nowrap;
  margin-bottom: 2px;
}

.speed-value,
.font-value {
  color: #44ff44;
  font-weight: bold;
  white-space: nowrap;
}

/* Status Table Styles - Responsive */
.status-table {
  position: absolute;
  top: 20px;
  right: var(--control-padding);
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #00ff00;
  border-radius: 6px;
  padding: 16px;
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-large);
  color: #00ff00;
  text-shadow: 0 0 3px #00ff00;
  z-index: 1000;
  min-width: var(--control-width);
  backdrop-filter: blur(2px);
  transition: all 0.3s ease;
}

/* Mobile responsive adjustments for status table */
@media screen and (max-width: 768px) {
  .status-table {
    position: fixed;
    top: 20px;
    left: 20px;
    right: 20px;
    width: auto;
    min-width: auto;
    border-radius: 12px;
    padding: 12px;
    font-size: 12px;
  }
}

@media screen and (max-width: 480px) {
  .status-table {
    top: 10px;
    left: 10px;
    right: 10px;
    padding: 10px;
    font-size: 10px;
    border-radius: 8px;
  }
}

.status-header {
  text-align: center;
  font-weight: bold;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid #00ff00;
  color: #44ff44;
  letter-spacing: 1.5px;
  font-size: 16px;
}

.status-grid {
  width: 100%;
  border-collapse: collapse;
}

.status-grid tr {
  margin: 4px 0;
}

.status-label {
  text-align: left;
  padding: 4px 8px 4px 0;
  font-weight: bold;
  color: #00aa00;
  min-width: 80px;
  font-size: 13px;
}

.status-value {
  text-align: right;
  padding: 4px 0 4px 8px;
  color: #44ff44;
  font-weight: normal;
  white-space: nowrap;
  font-size: 13px;
}

/* Key Bindings Table Styles - Responsive */
.keybindings-table {
  position: absolute;
  top: 280px;
  right: var(--control-padding);
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #00ff00;
  border-radius: 6px;
  padding: 16px;
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-medium);
  color: #00ff00;
  text-shadow: 0 0 3px #00ff00;
  z-index: 1000;
  min-width: var(--control-width);
  backdrop-filter: blur(2px);
  transition: all 0.3s ease;
}

/* Mobile responsive adjustments for key bindings table */
@media screen and (max-width: 768px) {
  .keybindings-table {
    display: none; /* Hide on mobile to save space */
  }
}

/* Show key bindings on larger mobiles if space allows */
@media screen and (max-width: 768px) and (min-height: 800px) {
  .keybindings-table {
    display: block;
    position: fixed;
    bottom: 300px;
    left: 20px;
    right: 20px;
    top: auto;
    width: auto;
    min-width: auto;
    border-radius: 12px;
    padding: 8px;
    font-size: 10px;
  }
}

.keybindings-header {
  text-align: center;
  font-weight: bold;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid #00ff00;
  color: #44ff44;
  letter-spacing: 1.5px;
  font-size: 14px;
}

.keybindings-grid {
  width: 100%;
  border-collapse: collapse;
}

.keybindings-grid tr {
  margin: 3px 0;
}

.key-label {
  text-align: left;
  padding: 3px 8px 3px 0;
  font-weight: bold;
  color: #00aa00;
  min-width: 70px;
  font-size: 11px;
}

.key-description {
  text-align: right;
  padding: 3px 0 3px 8px;
  color: #44ff44;
  font-weight: normal;
  white-space: nowrap;
  font-size: 11px;
}
</style>
