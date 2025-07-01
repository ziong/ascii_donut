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
          <span>Pitch: {{ headPose.pitch.toFixed(2) }}°</span>
        </div>
        <div class="data-row">
          <span>Yaw: {{ headPose.yaw.toFixed(2) }}°</span>
        </div>
        <div class="data-row">
          <span>Roll: {{ headPose.roll.toFixed(2) }}°</span>
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

// Calculate head pose from landmarks
const calculateHeadPose = (landmarks: any): { pitch: number, yaw: number, roll: number } => {
  // Get key facial landmarks
  const noseTip = landmarks.positions[30] // Nose tip
  const leftEye = landmarks.positions[36] // Left eye corner
  const rightEye = landmarks.positions[45] // Right eye corner
  const leftMouth = landmarks.positions[48] // Left mouth corner
  const rightMouth = landmarks.positions[54] // Right mouth corner
  
  // Calculate basic head pose angles
  // This is a simplified calculation - in production you'd use more sophisticated methods
  
  // Yaw (left-right head turn)
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2
  }
  const yaw = Math.atan2(noseTip.x - eyeCenter.x, 50) * (180 / Math.PI)
  
  // Pitch (up-down head tilt)
  const mouthCenter = {
    x: (leftMouth.x + rightMouth.x) / 2,
    y: (leftMouth.y + rightMouth.y) / 2
  }
  const pitch = Math.atan2(eyeCenter.y - mouthCenter.y, 80) * (180 / Math.PI)
  
  // Roll (head rotation)
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI)
  
  return { pitch: -pitch, yaw: yaw * 2, roll }
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
      // Use the first detected face
      const detection = detections[0]
      
      // Calculate head pose from landmarks
      const pose = calculateHeadPose(detection.landmarks)
      headPose.value = pose
      
      // Emit pose change
      emit('headPoseChange', pose)
      
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
          
          // Draw landmarks
          ctx.fillStyle = '#00ff00'
          detection.landmarks.positions.forEach((point: any) => {
            ctx.beginPath()
            ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI)
            ctx.fill()
          })
        }
      }
      
    } else {
      // No face detected
      if (isTracking.value) {
        isTracking.value = false
        emit('trackingStatusChange', false)
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
    detectionInterval = setInterval(detectFaces, 100) // 10 FPS
    statusText.value = 'Tracking...'
    
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