// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
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
  vite: {
    server: {
      // Configure HMR for Replit or similar environments
      hmr: {
        protocol: 'wss', // Use 'wss' for HTTPS, 'ws' for HTTP
        // Dynamically set the host for HMR using Replit environment variables if available
        // Fallback to 'localhost' if not in a Replit-like environment or vars are not set
        host: process.env.REPL_SLUG && process.env.REPL_OWNER
              ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
              : 'localhost',
        // clientPort: 443 // Usually not needed if host and protocol are correct
      },
      // Allow requests from any host.
      // This is generally acceptable for development in trusted environments like Replit.
      // Be cautious if deploying to a more open or production environment.
      allowedHosts: ['*'],
    }
  }
})
