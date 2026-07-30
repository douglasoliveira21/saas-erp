import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary, FeedbackProvider } from './components/ui'
import './index.css'

const chunkReloadKey = 'vgon_chunk_reload'
function recoverFromStaleChunk(event?: Event) {
  event?.preventDefault?.()
  if (sessionStorage.getItem(chunkReloadKey)) return
  sessionStorage.setItem(chunkReloadKey, String(Date.now()))
  window.location.reload()
}
window.addEventListener('vite:preloadError', recoverFromStaleChunk)
window.addEventListener('unhandledrejection', event => {
  const message = String(event.reason?.message || event.reason || '')
  if (/dynamically imported module|failed to fetch|loading chunk|chunkloaderror/i.test(message)) recoverFromStaleChunk(event)
})
window.setTimeout(() => sessionStorage.removeItem(chunkReloadKey), 15000)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
