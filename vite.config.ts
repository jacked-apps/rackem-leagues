import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Read VITE_APP_ENV at config-load time so the PWA manifest (app name, icons,
// theme color) can differ per deploy environment. This is what makes the
// home-screen icon and installed app name show "BETA" on staging installs.
// See scripts/generate-env-icons.mjs for the PNG generation.
const appEnv = process.env.VITE_APP_ENV || 'development';
const isStagingBuild = appEnv === 'staging';
const isDevBuild = appEnv === 'development';

const pwaIconDir =
  isStagingBuild ? '/icons-staging' : isDevBuild ? '/icons-dev' : '/icons';

// Production icons live in /icons/ with the original rackem-icon* filenames.
// Staging and dev icons live in /icons-staging/ and /icons-dev/ with a
// normalized naming (icon-192, icon-512, apple-touch-icon) generated from
// the favicon SVGs by scripts/generate-env-icons.mjs.
const pwaIcons =
  appEnv === 'production'
    ? [
        { src: '/icons/rackem-iconmdpi.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/rackem-iconhdpi.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/icons/rackem-iconhdpi.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable' as const,
        },
      ]
    : [
        { src: `${pwaIconDir}/icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${pwaIconDir}/icon-512.png`, sizes: '512x512', type: 'image/png' },
        {
          src: `${pwaIconDir}/icon-512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable' as const,
        },
      ];

const appName = isStagingBuild
  ? "Rack 'Em BETA"
  : isDevBuild
    ? "Rack 'Em DEV"
    : "Rack 'Em Leagues";

const shortName = isStagingBuild
  ? "R'Em BETA"
  : isDevBuild
    ? "R'Em DEV"
    : "Rack 'Em";

// Amber for staging, red for dev, original teal for production.
const themeColor = isStagingBuild
  ? '#F59E0B'
  : isDevBuild
    ? '#DC2626'
    : '#539dc2';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      // injectManifest: we author the service worker (src/sw.ts) so it can
      // handle Web Push + tap-to-open. Registration is unchanged (PWAUpdatePrompt
      // via virtual:pwa-register); update posture stays 'prompt'.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      includeAssets: [
        'favicon*.svg',
        'icons/*.png',
        'icons/*.svg',
        'icons-staging/*.png',
        'icons-dev/*.png',
      ],
      manifest: {
        name: appName,
        short_name: shortName,
        description: 'Pool league management app for tracking teams, players, and matches',
        theme_color: themeColor,
        background_color: themeColor,
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: pwaIcons,
      },
      // Runtime caching now lives in src/sw.ts (ported 1:1 from the old
      // workbox.runtimeCaching). This block only controls what gets precached
      // into self.__WB_MANIFEST.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
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
