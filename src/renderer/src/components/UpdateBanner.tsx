import { useEffect, useState } from 'react'
import { Download, RefreshCw, X, AlertCircle } from 'lucide-react'

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'ready'; version: string }
  | { phase: 'error'; message: string }

export default function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    window.api.onUpdateAvailable(({ version }) => {
      setState({ phase: 'available', version })
      setDismissed(false)
    })

    window.api.onUpdateProgress(({ percent }) => {
      setState((prev) => ({
        phase: 'downloading',
        version: prev.phase === 'available' || prev.phase === 'downloading' ? prev.version : '',
        percent,
      }))
    })

    window.api.onUpdateDownloaded(({ version }) => {
      setState({ phase: 'ready', version })
    })

    window.api.onUpdateError((message) => {
      setState({ phase: 'error', message })
    })
  }, [])

  if (state.phase === 'idle' || dismissed) return null

  const handleDownload = () => {
    window.api.updateDownload()
    setState((prev) =>
      prev.phase === 'available'
        ? { phase: 'downloading', version: prev.version, percent: 0 }
        : prev
    )
  }

  const handleInstall = () => window.api.updateInstall()

  const handleDismiss = () => setDismissed(true)

  return (
    <div style={styles.banner}>
      <div style={styles.content}>
        {state.phase === 'available' && (
          <>
            <Download size={16} style={{ flexShrink: 0 }} />
            <span>
              Update <strong>v{state.version}</strong> available
            </span>
            <button style={styles.btnPrimary} onClick={handleDownload}>
              Download
            </button>
          </>
        )}

        {state.phase === 'downloading' && (
          <>
            <RefreshCw size={16} style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />
            <span>Downloading update… {state.percent}%</span>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${state.percent}%` }} />
            </div>
          </>
        )}

        {state.phase === 'ready' && (
          <>
            <Download size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>v{state.version}</strong> ready to install
            </span>
            <button style={styles.btnPrimary} onClick={handleInstall}>
              Restart &amp; Install
            </button>
          </>
        )}

        {state.phase === 'error' && (
          <>
            <AlertCircle size={16} style={{ flexShrink: 0, color: 'var(--danger-color)' }} />
            <span style={{ color: 'var(--danger-color)' }}>Update failed: {state.message}</span>
          </>
        )}
      </div>

      {state.phase !== 'downloading' && (
        <button style={styles.dismiss} onClick={handleDismiss} title="Dismiss">
          <X size={14} />
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 16px',
    background: '#1c2333',
    borderTop: '1px solid var(--panel-border)',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  btnPrimary: {
    padding: '4px 12px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--accent-color)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 600,
    flexShrink: 0,
  },
  dismiss: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 4,
    flexShrink: 0,
  },
  progressTrack: {
    flex: 1,
    maxWidth: 200,
    height: 4,
    background: 'var(--panel-border)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent-color)',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
}
