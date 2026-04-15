import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AnalyticsTracker } from './components/AnalyticsTracker'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AnalyticsTracker />
  </StrictMode>,
)
