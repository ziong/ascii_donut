<template>
  <ClientOnly>
    <div class="head-tracker-container" v-if="isMounted">
      <!-- Webcam Video Element -->
      <video 
        ref="videoElement" 
        class="webcam-video"
        :class="{ 'hidden': !showPreview }"
        autoplay 
        muted 
        playsinline
      ></video>
      
      <!-- Canvas for face detection overlay -->
      <canvas 
        ref="canvasElement" 
        class="detection-canvas"
        :class="{ 'hidden': !showPreview || !showDetections }"
      ></canvas>
      
      <!-- Head tracking status -->
      <div class="tracking-status" v-if="trackingEnabled">
        <div class="status-indicator" :class="{ 'active': isTracking }"></div>
        <span class="status-text">{{ statusText }}</span>
      </div>
      
      <!-- Head tracking data display -->
      <div class="tracking-data" v-if="showDebugInfo && headPose">
        <div class="data-row">
          <span>ΔX: {{ headPose.deltaX ? headPose.deltaX.toFixed(1) : '0' }}px</span>
        </div>
        <div class="data-row">
          <span>ΔY: {{ headPose.deltaY ? headPose.deltaY.toFixed(1) : '0' }}px</span>
        </div>
        <div class="data-row">
          <span>Yaw: {{ headPose.yaw.toFixed(4) }}</span>
        </div>
        <div class="data-row">
          <span>Pitch: {{ headPose.pitch.toFixed(4) }}</span>
        </div>
        <div class="data-row" v-if="isCalibrating">
          <span>Cal: {{ calibrationFrames }}/{{ calibrationRequired }}</span>
        </div>
      </div>
      
      <!-- Error display -->
      <div class="error-message" v-if="error">
        {{ error }}
      </div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

// Props
interface Props {
  trackingEnabled?: boolean
  showPreview?: boolean
  showDetections?: boolean
  showDebugInfo?: boolean
  onHeadPoseChange?: (pose: { pitch: number, yaw: number, roll: number }) => void
}

const props = withDefaults(defineProps<Props>(), {
  trackingEnabled: false,
  showPreview: true,
  showDetections: false,
  showDebugInfo: false
})

// Emits
const emit = defineEmits<{
  headPoseChange: [pose: { pitch: number, yaw: number, roll: number }]
  trackingStatusChange: [isTracking: boolean]
  error: [error: string]
}>()

// Template refs
const videoElement = ref<HTMLVideoElement | null>(null)
const canvasElement = ref<HTMLCanvasElement | null>(null)

// State
const isMounted = ref(false)
const isTracking = ref(false)
const error = ref<string>('')
const headPose = ref<{ pitch: number, yaw: number, roll: number } | null>(null)
const statusText = ref('Initializing...')

// Head movement tracking for relative motion
const headCenter = ref<{ x: number, y: number } | null>(null)
const lastHeadCenter = ref<{ x: number, y: number } | null>(null)
const isCalibrating = ref(false)
const calibrationFrames = ref(0)
const calibrationRequired = 10 // Reduced frames needed for calibration
let missedFrames = 0 // Track consecutive missed detections

// Face-api instance and models
let faceApi: any = null
let modelsLoaded = false
let stream: MediaStream | null = null
let detectionInterval: ReturnType<typeof setInterval> | null = null

// Computed status text
const getStatusText = () => {
  if (error.value) return 'Error'
  if (!modelsLoaded) return 'Loading models...'
  if (!stream) return 'Accessing camera...'
  if (!isTracking.value) return 'No face detected'
  return 'Tracking active'
}

// Initialize webcam
const initializeWebcam = async (): Promise<boolean> => {
  try {
    if (!videoElement.value) {
      throw new Error('Video element not available')
    }

    // Request camera access
    const constraints = {
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        facingMode: 'user'
      },
      audio: false
    }

    stream = await navigator.mediaDevices.getUserMedia(constraints)
    videoElement.value.srcObject = stream
    
    return new Promise((resolve) => {
      videoElement.value!.onloadeddata = () => {
        statusText.value = 'Camera ready'
        resolve(true)
      }
    })
    
  } catch (err: any) {
    const errorMsg = `Camera access failed: ${err.message}`
    error.value = errorMsg
    emit('error', errorMsg)
    return false
  }
}

// Load face-api models
const loadModels = async (): Promise<boolean> => {
  try {
    const nuxtApp = useNuxtApp()
    
    if (!nuxtApp.$faceapi || !nuxtApp.$loadFaceApiModels) {
      throw new Error('Face-api plugin not available')
    }
    
    faceApi = nuxtApp.$faceapi
    modelsLoaded = await nuxtApp.$loadFaceApiModels()
    
    if (modelsLoaded) {
      statusText.value = 'Models loaded'
    } else {
      throw new Error('Failed to load face detection models')
    }
    
    return modelsLoaded
  } catch (err: any) {
    const errorMsg = `Model loading failed: ${err.message}`
    error.value = errorMsg
    emit('error', errorMsg)
    return false
  }
}

// Calculate head center position for relative movement tracking
const calculateHeadCenter = (landmarks: any): { x: number, y: number } => {
  // Use face center (average of key landmarks for stability)
  const noseTip = landmarks.positions[30] // Nose tip
  const leftEye = landmarks.positions[36] // Left eye corner
  const rightEye = landmarks.positions[45] // Right eye corner
  const chin = landmarks.positions[8] // Chin
  const forehead = landmarks.positions[24] // Forehead center
  
  // Calculate center as average of key facial points
  const centerX = (noseTip.x + leftEye.x + rightEye.x + chin.x + forehead.x) / 5
  const centerY = (noseTip.y + leftEye.y + rightEye.y + chin.y + forehead.y) / 5
  
  return { x: centerX, y: centerY }
}

// Calculate head movement delta and convert to rotation
const calculateMovementDelta = (currentCenter: { x: number, y: number }) => {
  if (!lastHeadCenter.value) {
    return { deltaX: 0, deltaY: 0, pitch: 0, yaw: 0 }
  }
  
  // Calculate pixel movement
  const deltaX = currentCenter.x - lastHeadCenter.value.x
  const deltaY = currentCenter.y - lastHeadCenter.value.y
  
  // Convert pixel movement to rotation angles
  // Separate sensitivity for each axis
  const sensitivityX = 0.03 // X-axis (horizontal) sensitivity for yaw rotation
  const sensitivityY = 0.01 // Y-axis (vertical) sensitivity for pitch rotation
  
  // Right movement = positive yaw (clockwise rotation)
  // Down movement = positive pitch (forward tilt)
  const yaw = deltaX * sensitivityX
  const pitch = deltaY * sensitivityY
  
  return { deltaX, deltaY, pitch, yaw }
}

// Detect faces and track head pose
const detectFaces = async () => {
  if (!videoElement.value || !faceApi || !modelsLoaded || !props.trackingEnabled) {
    return
  }

  try {
    // Detect faces with landmarks
    const detections = await faceApi
      .detectAllFaces(videoElement.value, new faceApi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
    
    if (detections && detections.length > 0) {
      // Reset missed frames counter on successful detection
      missedFrames = 0
      
      // Use the first detected face
      const detection = detections[0]
      
      // Calculate current head center position
      const currentCenter = calculateHeadCenter(detection.landmarks)
      headCenter.value = currentCenter
      
      // Handle calibration phase - only calibrate if we don't have a baseline
      if (!lastHeadCenter.value) {
        if (calibrationFrames.value < calibrationRequired) {
          calibrationFrames.value++
          isCalibrating.value = true
          statusText.value = `Calibrating... ${calibrationFrames.value}/${calibrationRequired}`
          lastHeadCenter.value = currentCenter
          return
        } else {
          isCalibrating.value = false
          statusText.value = 'Ready - Move your head to control rotation'
        }
      }
      
      // Calculate movement delta and emit relative movement
      const movement = calculateMovementDelta(currentCenter)
      
      // Create pose object with delta movement
      const pose = {
        pitch: movement.pitch,
        yaw: movement.yaw,
        roll: 0, // Not using roll for now
        deltaX: movement.deltaX,
        deltaY: movement.deltaY
      }
      
      headPose.value = pose
      
      // Only emit if there's meaningful movement (reduced threshold)
      if (Math.abs(movement.deltaX) > 0.3 || Math.abs(movement.deltaY) > 0.3) {
        emit('headPoseChange', pose)
      }
      
      // Update last position for next frame
      lastHeadCenter.value = currentCenter
      
      // Update tracking status
      if (!isTracking.value) {
        isTracking.value = true
        emit('trackingStatusChange', true)
      }
      
      // Draw detection overlay if enabled
      if (props.showDetections && canvasElement.value) {
        const canvas = canvasElement.value
        const ctx = canvas.getContext('2d')
        if (ctx) {
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          
          // Draw face bounding box
          const box = detection.detection.box
          ctx.strokeStyle = '#00ff00'
          ctx.lineWidth = 2
          ctx.strokeRect(box.x, box.y, box.width, box.height)
          
          // Draw head center point
          ctx.fillStyle = '#ff0000'
          ctx.beginPath()
          ctx.arc(currentCenter.x, currentCenter.y, 4, 0, 2 * Math.PI)
          ctx.fill()
          
          // Draw movement vector if there's a previous position
          if (lastHeadCenter.value) {
            ctx.strokeStyle = '#ff0000'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(lastHeadCenter.value.x, lastHeadCenter.value.y)
            ctx.lineTo(currentCenter.x, currentCenter.y)
            ctx.stroke()
          }
          
          // Draw landmarks if enabled
          if (props.showDebugInfo) {
            ctx.fillStyle = '#00ff00'
            detection.landmarks.positions.forEach((point: any) => {
              ctx.beginPath()
              ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI)
              ctx.fill()
            })
          }
        }
      }
      
    } else {
      // No face detected - only reset after several consecutive missed frames
      missedFrames++
      
      // Only reset tracking after missing face for 15+ consecutive frames (~1.5 seconds)
      if (missedFrames > 15 && isTracking.value) {
        isTracking.value = false
        isCalibrating.value = false
        calibrationFrames.value = 0
        lastHeadCenter.value = null
        headCenter.value = null
        emit('trackingStatusChange', false)
        statusText.value = 'Face lost - looking for face...'
      }
    }
    
    statusText.value = getStatusText()
    
  } catch (err: any) {
    console.error('Face detection error:', err)
  }
}

// Start head tracking
const startTracking = async () => {
  if (!props.trackingEnabled) return
  
  try {
    // Reset calibration when starting
    isCalibrating.value = false
    calibrationFrames.value = 0
    lastHeadCenter.value = null
    headCenter.value = null
    missedFrames = 0
    
    // Load models first
    if (!modelsLoaded) {
      statusText.value = 'Loading models...'
      const loaded = await loadModels()
      if (!loaded) return
    }
    
    // Initialize webcam
    statusText.value = 'Accessing camera...'
    const webcamReady = await initializeWebcam()
    if (!webcamReady) return
    
    // Set up canvas dimensions
    if (canvasElement.value && videoElement.value) {
      canvasElement.value.width = videoElement.value.videoWidth || 320
      canvasElement.value.height = videoElement.value.videoHeight || 240
    }
    
    // Start detection loop
    detectionInterval = setInterval(detectFaces, 125) // 8 FPS for better stability
    statusText.value = 'Calibrating...'
    
  } catch (err: any) {
    const errorMsg = `Tracking initialization failed: ${err.message}`
    error.value = errorMsg
    emit('error', errorMsg)
  }
}

// Stop head tracking
const stopTracking = () => {
  if (detectionInterval) {
    clearInterval(detectionInterval)
    detectionInterval = null
  }
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  
  isTracking.value = false
  headPose.value = null
  statusText.value = 'Stopped'
  emit('trackingStatusChange', false)
}

// Watch for tracking enabled changes
watch(() => props.trackingEnabled, (enabled) => {
  if (enabled) {
    nextTick(() => startTracking())
  } else {
    stopTracking()
  }
})

onMounted(() => {
  isMounted.value = true
  if (props.trackingEnabled) {
    nextTick(() => startTracking())
  }
})

onUnmounted(() => {
  stopTracking()
})
</script>

<style scoped>
.head-tracker-container {
  position: relative;
  width: 320px;
  height: 240px;
}

/* Responsive sizing for different screen layouts */
@media screen and (min-width: 1200px) {
  .head-tracker-container {
    width: 240px;
    height: 180px;
  }
}

@media screen and (max-width: 767px) {
  .head-tracker-container {
    width: 280px;
    height: 210px;
  }
}

.webcam-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #00ff00;
}

.detection-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  border-radius: 8px;
}

.hidden {
  display: none;
}

.tracking-status {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.8);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #00ff00;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  margin-right: 6px;
}

.status-indicator.active {
  background: #00ff00;
  box-shadow: 0 0 6px #00ff00;
}

.status-text {
  text-shadow: 0 0 3px #00ff00;
}

.tracking-data {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.8);
  padding: 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #00ff00;
  text-shadow: 0 0 3px #00ff00;
}

.data-row {
  margin-bottom: 2px;
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  text-align: center;
  max-width: 90%;
}
</style>