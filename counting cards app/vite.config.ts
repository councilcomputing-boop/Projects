import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate' so a fresh deploy takes effect on the visitor's next normal reload
      // instead of sitting inactive behind an update banner they have to notice and
      // click — this app has no users yet, so update friction only costs dev iteration.
      registerType: 'autoUpdate',
      includeAssets: ['icon.ico'],
      manifest: {
        name: 'CountDracula',
        short_name: 'CountDracula',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#120709',
        theme_color: '#2b0d15',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // Matches the live app's network-first-with-cache-fallback strategy: always try
        // the network first (so a fresh deploy is picked up immediately when online),
        // fall back to cache only when offline.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages' }
          },
          {
            urlPattern: ({ request }) => ['style', 'script', 'image', 'font'].includes(request.destination),
            handler: 'NetworkFirst',
            options: { cacheName: 'assets' }
          }
        ]
      }
    })
  ],
})
