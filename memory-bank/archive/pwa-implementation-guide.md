# PWA Implementation Guide

This guide walks through adding Progressive Web App (PWA) functionality to the Rack Track app.

## What We're Building

A "shell-only" PWA that:
- ✅ Is installable on phones/desktops (shows "Add to Home Screen")
- ✅ Loads the app UI even when offline
- ✅ Shows friendly "You're offline" messages for database operations
- ✅ Prompts users to refresh when updates are available
- ❌ Does NOT cache database data for offline use (too complex for our needs)

---

## Step 1: Install the PWA Plugin

Run this command:

```bash
pnpm add -D vite-plugin-pwa
```

This plugin handles most of the complexity for us:
- Generates the web app manifest
- Generates the service worker
- Provides React hooks for update prompts

---

## Step 2: Generate Icon Files

PWAs need PNG icons in specific sizes. You have `public/rack-icon.svg` which we'll use as the source.

### Required Icon Sizes
- **192x192** - Required minimum for Android
- **512x512** - Required for splash screens
- **180x180** - Apple touch icon (iOS)
- **Optional**: 48, 72, 96, 128, 144, 256, 384 for better device coverage

### How to Generate Icons

**Option A: Online Tool (Easiest)**
1. Go to https://realfavicongenerator.net/
2. Upload your SVG
3. Download the generated package
4. Copy the PNG files to `/public/icons/`

**Option B: Command Line Tool**
```bash
# Install sharp-cli globally
pnpm add -g sharp-cli

# Create icons folder
mkdir -p public/icons

# Generate from SVG (run from project root)
sharp -i public/rack-icon.svg -o public/icons/icon-192.png resize 192 192
sharp -i public/rack-icon.svg -o public/icons/icon-512.png resize 512 512
sharp -i public/rack-icon.svg -o public/icons/apple-touch-icon.png resize 180 180
```

**Option C: Use Figma/Design Tool**
Export your SVG at the required sizes manually.

### Expected File Structure
```
public/
  icons/
    icon-192.png
    icon-512.png
    apple-touch-icon.png
  rack-icon.svg (keep as favicon)
```

---

## Step 3: Configure Vite for PWA

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'prompt', // Show "update available" prompt
      includeAssets: ['favicon.svg', 'rack-icon.svg', 'icons/*.png'],
      manifest: {
        name: 'Rack Track - Pool League Management',
        short_name: 'Rack Track',
        description: 'Professional pool league management and scorekeeping',
        theme_color: '#1a1a2e', // Dark theme color
        background_color: '#1a1a2e',
        display: 'standalone', // Hides browser chrome
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable', // For Android adaptive icons
          },
        ],
      },
      workbox: {
        // Only cache static assets, NOT API calls
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Don't cache Supabase API calls
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  // ... rest of your config stays the same
});
```

---

## Step 4: Add Update Prompt Component

Create `src/components/pwa/PWAUpdatePrompt.tsx`:

```tsx
/**
 * @fileoverview PWA Update Prompt Component
 *
 * Displays a toast notification when a new version of the app is available.
 * Uses the vite-plugin-pwa hooks to detect updates and trigger refresh.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      // Check for updates every hour
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-primary p-4 text-primary-foreground shadow-lg">
      <RefreshCw className="h-5 w-5" />
      <span className="text-sm font-medium">New version available!</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => updateServiceWorker(true)}
      >
        Update
      </Button>
    </div>
  );
}
```

---

## Step 5: Add TypeScript Types for PWA

Create `src/types/pwa.d.ts`:

```typescript
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register/react' {
  import type { Dispatch, SetStateAction } from 'react';

  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: Error) => void;
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
```

---

## Step 6: Add PWAUpdatePrompt to App

In your root `App.tsx` or layout component, add:

```tsx
import { PWAUpdatePrompt } from '@/components/pwa/PWAUpdatePrompt';

function App() {
  return (
    <>
      {/* Your existing app content */}
      <PWAUpdatePrompt />
    </>
  );
}
```

---

## Step 7: Update index.html

Add these meta tags to `index.html` in the `<head>`:

```html
<!-- PWA Meta Tags -->
<meta name="theme-color" content="#1a1a2e" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Rack Track" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

---

## Step 8: Handle Offline State (Optional but Recommended)

Create a hook to detect online/offline status:

`src/hooks/useOnlineStatus.ts`:

```typescript
/**
 * @fileoverview Hook to track browser online/offline status
 */
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

Then you can show an offline banner in your app:

```tsx
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-destructive p-2 text-center text-destructive-foreground">
      <WifiOff className="inline h-4 w-4 mr-2" />
      You're offline. Some features may be unavailable.
    </div>
  );
}
```

---

## Step 9: Test the PWA

### Development Testing
```bash
pnpm run build
pnpm run preview
```

PWA features only work in production builds! The dev server won't show install prompts.

### What to Test
1. **Install prompt**: In Chrome, look for the install icon in the address bar
2. **Lighthouse audit**: DevTools → Lighthouse → Check "Progressive Web App"
3. **Offline mode**: DevTools → Network → Check "Offline" → Refresh the page
4. **Update prompt**: Make a change, rebuild, and refresh to see the update toast

### Mobile Testing
1. Deploy to a staging environment (needs HTTPS)
2. Open on your phone
3. Look for "Add to Home Screen" prompt or use browser menu

---

## Troubleshooting

### "Install" button not showing
- Must be served over HTTPS (or localhost)
- Must have valid manifest.json
- Must have a service worker
- Check Chrome DevTools → Application → Manifest for errors

### Service worker not updating
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- DevTools → Application → Service Workers → "Update on reload"

### Icons not displaying
- Verify PNG files exist in `/public/icons/`
- Check DevTools → Application → Manifest → Icons section
- Ensure icons are exactly 192x192 and 512x512

---

## Files Created/Modified Checklist

- [ ] `pnpm add -D vite-plugin-pwa`
- [ ] Create `/public/icons/icon-192.png`
- [ ] Create `/public/icons/icon-512.png`
- [ ] Create `/public/icons/apple-touch-icon.png`
- [ ] Update `vite.config.ts` with VitePWA plugin
- [ ] Create `src/types/pwa.d.ts`
- [ ] Create `src/components/pwa/PWAUpdatePrompt.tsx`
- [ ] Update `App.tsx` to include PWAUpdatePrompt
- [ ] Update `index.html` with PWA meta tags
- [ ] (Optional) Create `src/hooks/useOnlineStatus.ts`
- [ ] (Optional) Add offline banner component

---

## Next Steps After Basic PWA

Once the basic PWA is working, you could consider:

1. **Push Notifications** - Notify users about match results, schedule changes
2. **Background Sync** - Queue actions while offline, sync when back online
3. **Selective Data Caching** - Cache read-only data like venue lists for offline viewing

These are more advanced and can be added later if needed.
