import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AnalyticsTracker } from './components/AnalyticsTracker'
import { I18nProvider } from './locales'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
      <AnalyticsTracker />
      <SpeedInsights />
    </I18nProvider>
  </StrictMode>,
)
