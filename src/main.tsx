import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './api/client'
import { applyEnvironmentBranding } from './config/environment'
import { startInstallCapture } from './hooks/useInstallApp'
import './index.css'
import App from './App.tsx'

applyEnvironmentBranding()
// Capture the PWA install prompt immediately — it often fires early in page
// load (before any install UI mounts) and is single-use.
startInstallCapture()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
