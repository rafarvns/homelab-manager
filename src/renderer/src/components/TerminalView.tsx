import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { useAppStore } from '../store'

interface TerminalViewProps {
  sessionId: string;
  isActive: boolean;
}

export default function TerminalView({ sessionId, isActive }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { updateSessionStatus } = useAppStore()

  useEffect(() => {
    if (!terminalRef.current) return

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Fira Code", "Consolas", monospace',
      fontSize: 14,
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: 'rgba(88, 166, 255, 0.3)',
      }
    })
    
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    
    term.open(terminalRef.current)
    fitAddon.fit()
    
    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Send keystrokes to main process
    term.onData(data => {
      window.api.sshInput(sessionId, data)
    })

    // Resize handler
    const handleResize = () => {
      if (isActive && fitAddonRef.current) {
        fitAddonRef.current.fit()
        window.api.sshResize(sessionId, term.cols, term.rows)
      }
    }

    // Initial resize trigger
    setTimeout(handleResize, 100)
    window.addEventListener('resize', handleResize)

    // Receive data from main process
    window.api.onSshData(sessionId, (data) => {
      term.write(data)
    })

    // Status updates
    window.api.onSshStatus(sessionId, (status) => {
      updateSessionStatus(sessionId, status as any)
      if (status === 'disconnected') {
        term.write('\r\n\x1b[31;1m[Session Disconnected]\x1b[0m\r\n')
      }
    })

    return () => {
      window.removeEventListener('resize', handleResize)
      window.api.removeSshListeners(sessionId)
      term.dispose()
    }
  }, [sessionId]) // Run once per session

  // Refit when becoming active
  useEffect(() => {
    if (isActive && fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current!.fit()
        window.api.sshResize(sessionId, xtermRef.current!.cols, xtermRef.current!.rows)
      }, 50)
    }
  }, [isActive, sessionId])

  return (
    <div 
      className={`terminal-container ${isActive ? 'active' : ''}`} 
      style={{ height: '100%', width: '100%' }}
    >
      <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
