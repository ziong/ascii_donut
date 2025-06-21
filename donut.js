const donutElement = document.getElementById('donut');
const preTag = donutElement; // Assuming donutElement is already the pre tag

let A = 0, B = 0;

// Function to render the ASCII donut
const renderFrame = () => {
    const b = []; // Array to store Z-buffer values
    const z = []; // Array to store character output

    const R1 = 1; // Radius of the torus
    const R2 = 2; // Distance from center to the torus
    const K2 = 5; // Distance from viewer to screen
    // K1 is now global and updated by updateDimensions()

    // Clear arrays
    // Ensure screenWidth and screenHeight are positive before allocating
    const bufferSize = (screenWidth > 0 && screenHeight > 0) ? screenWidth * screenHeight : 0;
    if (bufferSize === 0) {
        console.warn("Screen dimensions are too small or invalid, skipping render.");
        preTag.textContent = "Window too small or error in dimension calculation.";
        return; // Skip rendering if dimensions are invalid
    }

    for (let k = 0; k < bufferSize; k++) {
        b[k] = 0;
        z[k] = ' ';
    }

    // Precompute sines and cosines
    const cA = Math.cos(A), sA = Math.sin(A);
    const cB = Math.cos(B), sB = Math.sin(B);

    // Theta loop (around the major circle)
    for (let theta = 0; theta < 2 * Math.PI; theta += 0.07) {
        const ct = Math.cos(theta), st = Math.sin(theta);

        // Phi loop (around the minor circle)
        for (let phi = 0; phi < 2 * Math.PI; phi += 0.02) {
            const cp = Math.cos(phi), sp = Math.sin(phi);

            // Coordinates of the point on the torus surface
            const x = R2 + R1 * ct;
            const y = R1 * st;

            // Rotated coordinates
            const x_ = x * (cB * cp + sA * sB * sp) - y * cA * sB;
            const y_ = x * (sB * cp - sA * cB * sp) + y * cA * cB;
            const z_ = K2 + cA * x * sp + y * sA;
            const ooz = 1 / z_; // One over Z

            // Project onto 2D screen
            const xp = Math.floor(screenWidth / 2 + K1 * ooz * x_);
            const yp = Math.floor(screenHeight / 2 - K1 * ooz * y_);

            // Calculate luminance
            const L1 = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp);
            if (L1 > 0) {
                const idx = xp + screenWidth * yp;
                if (ooz > b[idx]) {
                    b[idx] = ooz;
                    const luminance_index = Math.floor(L1 * 8); // L ranges from -sqrt(2) to +sqrt(2). We want to map L > 0 to 0..11
                    z[idx] = ".,-~:;=!*#$@"[luminance_index];
                }
            }
        }
    }

    // Display the frame
    let frame = "";
    for (let k = 0; k < screenWidth * screenHeight; k++) {
        frame += (k % screenWidth ? z[k] : '\n');
    }
    preTag.textContent = frame;

    A += 0.04; // Increment rotation angle A
    B += 0.02; // Increment rotation angle B
};

// Define screen size (can be adjusted)
// let screenWidth = 80; // old fixed size
// let screenHeight = 40; // old fixed size
let screenWidth, screenHeight;
let K1; // Declare K1 globally to be updated

// Function to calculate character dimensions (approximate)
function getCharDimensions() {
    const temp = document.createElement("span");
    temp.innerHTML = "X"; // Use a common character
    temp.style.fontFamily = getComputedStyle(preTag).fontFamily;
    temp.style.fontSize = getComputedStyle(preTag).fontSize;
    temp.style.position = "absolute";
    temp.style.visibility = "hidden";
    document.body.appendChild(temp);
    const charWidth = temp.offsetWidth;
    const charHeight = temp.offsetHeight;
    document.body.removeChild(temp);
    return { charWidth, charHeight };
}


// Function to update screen dimensions and related parameters
function updateDimensions() {
    const { charWidth, charHeight } = getCharDimensions();

    if (charWidth === 0 || charHeight === 0) {
        // Fallback if char dimensions are zero (e.g. display: none)
        // This might happen if called too early or preTag is not visible
        console.warn("Character dimensions are zero. Using fallback screen size.");
        screenWidth = 80;
        screenHeight = 40;
    } else {
        screenWidth = Math.floor(window.innerWidth / charWidth);
        screenHeight = Math.floor(window.innerHeight / charHeight);
    }

    // Ensure K1 is updated whenever screenWidth changes
    // Constants for torus geometry
    const R1 = 1; // Radius of the torus
    const R2 = 2; // Distance from center to the torus
    const K2 = 5; // Distance from viewer to screen
    K1 = screenWidth * K2 * 3 / (8 * (R1 + R2));

    // Optional: Adjust preTag font size slightly to fill space better, though this can be tricky
    // preTag.style.fontSize = Math.min(window.innerWidth / screenWidth, window.innerHeight / screenHeight) + 'px';
    // This would require re-calculating charWidth/Height and potentially loop, so be careful.
    // For now, we use the CSS font-size and calculate columns/rows based on that.

    console.log(`Screen dimensions: ${screenWidth}x${screenHeight} chars`);
    // No need to call renderFrame here, the interval will pick it up.
    // If there was an active animation frame, it should be restarted.
}

// Initial dimension update
updateDimensions();

// Add resize event listener
window.addEventListener('resize', () => {
    updateDimensions();
    // It's good practice to re-render immediately on resize for responsiveness
    // However, ensure renderFrame() can handle being called outside the interval.
    // If renderFrame is heavy, you might want to debounce this.
    renderFrame();
});

// Mouse dragging variables
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Event Listeners for mouse dragging
document.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    // Optional: Change cursor style while dragging
    document.body.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;

        // Adjust rotation angles based on mouse movement
        // The sensitivity can be adjusted by changing the divisor
        B += deltaX / 100; // Rotate around Y-axis (horizontal drag)
        A += deltaY / 100; // Rotate around X-axis (vertical drag)

        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        // It's better to call renderFrame directly here for smoother updates during drag
        // rather than waiting for the setInterval.
        // However, to avoid conflicts with the existing setInterval,
        // we'll let the interval handle rendering for now.
        // For a more responsive feel, one might clear the interval on mousedown
        // and use requestAnimationFrame during mousemove, then restart interval on mouseup.
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        // Optional: Restore cursor style
        document.body.style.cursor = 'default';
    }
});

document.addEventListener('mouseleave', () => {
    // Also stop dragging if mouse leaves the window
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
    }
});


// Start the rendering loop
let renderInterval = setInterval(renderFrame, 50); // Adjust timing for speed

console.log("Donut script loaded and rendering started. Mouse dragging enabled.");
