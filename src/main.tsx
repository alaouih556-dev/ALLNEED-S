import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from '@/router'
import { DemoStoreProvider } from '@/store/store'
import '@/index.css'
import '@/styles/marketing.css'
import { initI18n } from '@/i18n'

initI18n()

const container = document.getElementById('root')

if (!container) throw new Error('Élément #root introuvable')

createRoot(container).render(
  <StrictMode>
    <DemoStoreProvider>
      <RouterProvider router={router} />
    </DemoStoreProvider>
  </StrictMode>,
)
