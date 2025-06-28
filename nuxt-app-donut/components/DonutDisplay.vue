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
const fontSize = ref<number>(8); // Font size in pixels

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
  if (typeof window === 'undefined' || !donutPreElement.value) return;

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
  // Skip rendering during font size recalculation
  if (isRecalculating.value) {
    return;
  }
  
  if (!donutPreElement.value || K1.value === 0) { // Ensure K1 is initialized
    frameContent.value = "Initializing dimensions or K1 is zero...";
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
    A.value += 0.04;
    B.value += 0.02;
  }
};

// Mouse event handlers
const handleMouseDown = (e: MouseEvent) => {
  isDragging.value = true;
  lastMouseX.value = e.clientX;
  lastMouseY.value = e.clientY;
  if (donutPreElement.value) {
      donutPreElement.value.style.cursor = 'grabbing';
  }
};

const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value) {
    const deltaX = e.clientX - lastMouseX.value;
    const deltaY = e.clientY - lastMouseY.value;
    B.value += deltaX / 200; // Adjusted sensitivity
    A.value += deltaY / 200; // Adjusted sensitivity
    lastMouseX.value = e.clientX;
    lastMouseY.value = e.clientY;
    // Optimization: render immediately during drag if not relying on interval
    // For now, let interval handle it to keep it simple.
    // renderFrame();
  }
};

const handleMouseUpOrLeave = () => {
  if (isDragging.value) {
    isDragging.value = false;
    if (donutPreElement.value) {
        donutPreElement.value.style.cursor = 'grab';
    }
  }
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
    fontSize.value = Math.min(fontSize.value + 1, 24); // Max font size 24px
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
  const target = event.target as HTMLInputElement;
  zoomFactor.value = parseFloat(target.value);
  updateDimensions();
};

onMounted(() => {
  // Attach to window for global mouse capture and resize
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUpOrLeave);
  window.addEventListener('mouseleave', handleMouseUpOrLeave); // Ensure drag stops if mouse leaves window
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
  window.removeEventListener('mousedown', handleMouseDown);
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUpOrLeave);
  window.removeEventListener('mouseleave', handleMouseUpOrLeave);
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

.zoom-slider-container {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: row;
  align-items: center;
  z-index: 1000;
  width: auto;
  height: auto;
  pointer-events: auto;
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

/* Webkit browsers (Chrome, Safari) */
.zoom-slider::-webkit-slider-track {
  width: 120px;
  height: 4px;
  background: #333;
  border-radius: 2px;
}

.zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #00ff00;
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid #00aa00;
}

.zoom-slider::-webkit-slider-thumb:hover {
  background: #44ff44;
}

/* Firefox */
.zoom-slider::-moz-range-track {
  width: 120px;
  height: 4px;
  background: #333;
  border-radius: 2px;
  border: none;
}

.zoom-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #00ff00;
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid #00aa00;
}

.zoom-labels {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-left: 8px;
  font-family: 'Courier New', monospace;
  font-size: 10px;
  gap: 5px;
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
</style>
