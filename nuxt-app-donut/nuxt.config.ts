// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  // Configure client-side only rendering for face-api
  ssr: false, // Disable SSR to prevent hydration mismatches
  // Handle face-api imports that require browser APIs
  build: {
    transpile: ['@vladmandic/face-api']
  },
  app: {
    head: {
      title: 'ASCII Donut Nuxt',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { hid: 'description', name: 'description', content: '3D ASCII Donut rendered with Nuxt 3' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },
  css: ['~/assets/main.css'], // Assuming we will create this for global styles
  nitro: {
    devServer: {
      host: '0.0.0.0',
      port: 3000
    }
  },
  vite: {
    server: {
      host: '0.0.0.0',
      port: 3000,
      // Simplified HMR for development - disabled to avoid WebSocket issues with face-api
      hmr: false,
      // Allow requests from any host for development
      allowedHosts: ['*'],
    }
  }
})
