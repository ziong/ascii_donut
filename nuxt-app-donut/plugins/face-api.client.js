// Client-side only plugin for face-api
import * as faceapi from '@vladmandic/face-api'

export default defineNuxtPlugin(async () => {
  // Only run on client side
  if (process.client) {
    // Multiple CDN options for model loading, with local fallback
    const MODEL_URLS = [
      '/models', // Local models first
      'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model',
      'https://vladmandic.github.io/face-api/model',
      'https://raw.githubusercontent.com/vladmandic/face-api/master/model'
    ]
    
    // Provide face-api globally
    return {
      provide: {
        faceapi: faceapi,
        loadFaceApiModels: async () => {
          // Try each CDN URL until one works
          for (let i = 0; i < MODEL_URLS.length; i++) {
            const MODEL_URL = MODEL_URLS[i]
            try {
              console.log(`Attempting to load models from: ${MODEL_URL}`)
              
              // Test if we can fetch the manifest file first
              if (MODEL_URL === '/models') {
                const testResponse = await fetch('/models/tiny_face_detector_model-weights_manifest.json')
                console.log('Local manifest test response:', testResponse.status, testResponse.statusText)
                if (!testResponse.ok) {
                  throw new Error(`Local manifest not accessible: ${testResponse.status}`)
                }
              }
              
              // Load models one by one for better error isolation
              console.log('Loading tinyFaceDetector...')
              await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
              console.log('tinyFaceDetector loaded successfully')
              
              console.log('Loading faceLandmark68Net...')
              await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
              console.log('faceLandmark68Net loaded successfully')
              
              console.log('All Face-api models loaded successfully from:', MODEL_URL)
              return true
              
            } catch (error) {
              console.warn(`Failed to load models from ${MODEL_URL}:`, error.message || error)
              if (i === MODEL_URLS.length - 1) {
                // Last attempt failed
                console.error('All model loading attempts failed. Final error:', error)
                return false
              }
              // Continue to next URL
            }
          }
          return false
        }
      }
    }
  }
})