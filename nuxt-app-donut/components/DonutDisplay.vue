<template>
  <pre ref="donutPreElement" class="donut-pre-tag">{{ frameContent }}</pre>
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

// Mouse dragging state
const isDragging = ref<boolean>(false);
const lastMouseX = ref<number>(0);
const lastMouseY = ref<number>(0);

// Animation timer
let renderInterval: ReturnType<typeof setInterval> | null = null;

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
    temp.style.fontSize = computedStyle.fontSize;
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
    // Use clientWidth/Height of the pre element itself if it's constrained by CSS
    // Or window.innerWidth/Height if it's meant to fill the viewport
    // For now, assuming viewport fill as per original CSS.
    screenWidth.value = Math.floor(window.innerWidth / charWidth);
    screenHeight.value = Math.floor(window.innerHeight / charHeight);
  }

  K1.value = screenWidth.value * K2 * 3 / (8 * (R1 + R2));
  console.log(`Screen dimensions: ${screenWidth.value}x${screenHeight.value} chars. K1: ${K1.value}`);
};


const renderFrame = () => {
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

  if (!isDragging.value) {
    A.value += 0.04;
    B.value += 0.02;
  }
};

// Mouse event handlers
const handleMouseDown = (e: MouseEvent) => {
  isDragging.value = true;
  lastMouseX.value = e.clientX;
  lastMouseY.value = e.clientY;
  if (donutPreElement.value?.parentElement) { // Check if parentElement exists
      donutPreElement.value.parentElement.style.cursor = 'grabbing';
  } else if (document.body) { // Fallback to document.body if parentElement is null
      document.body.style.cursor = 'grabbing';
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
    if (donutPreElement.value?.parentElement) {
        donutPreElement.value.parentElement.style.cursor = 'default';
    } else if (document.body) {
        document.body.style.cursor = 'default';
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

onMounted(() => {
  // Attach to window for global mouse capture and resize
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUpOrLeave);
  window.addEventListener('mouseleave', handleMouseUpOrLeave); // Ensure drag stops if mouse leaves window
  window.addEventListener('resize', handleResize);

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
  // Restore cursor if component is unmounted while dragging
  if (document.body) {
      document.body.style.cursor = 'default';
  }
});

</script>

<style scoped>
.donut-pre-tag {
  font-size: 8px;
  line-height: 8px;
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
}
</style>
