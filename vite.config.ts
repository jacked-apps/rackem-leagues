import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon*.svg', 'icons/*.png', 'icons/*.svg'],
      manifest: {
        name: "Rack 'Em Leagues",
        short_name: "Rack 'Em",
        description: 'Pool league management app for tracking teams, players, and matches',
        theme_color: '#539dc2',
        background_color: '#539dc2',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/rackem-iconmdpi.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/rackem-iconhdpi.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/rackem-iconhdpi.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Allow network access (same as --host)
    port: 5173,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large libraries into separate chunks for better caching
          'date-holidays': ['date-holidays'],
          // Split Radix UI components (used across many pages)
          'radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-tabs',
            '@radix-ui/react-switch',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
          ],
          // Split Supabase client
          'supabase': ['@supabase/supabase-js'],
          // Split TanStack Query
          'tanstack': ['@tanstack/react-query'],
          // Split icons library (loaded on most pages)
          'icons': ['lucide-react'],
          // Split React Router
          'router': ['react-router-dom'],
        },
      },
    },
  },
});
