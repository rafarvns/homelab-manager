import { useEffect, useRef, memo } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { useAppStore } from '../store'

interface TerminalViewProps {
  sessionId: string;
  isActive: boolean;
  isHidden: boolean;
}

const TerminalView = memo(({ sessionId, isActive, isHidden }: TerminalViewProps) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { updateSessionStatus } = useAppStore()

  useEffect(() => {
    if (!terminalRef.current) return

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      cursorWidth: 2,
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      scrollback: 10000,
      allowTransparency: true,
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: 'rgba(88, 166, 255, 0.3)',
        // ANSI Colors
        black: '#0d1117',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#e6edf3',
        brightBlack: '#484f58',
        brightRed: '#ff7b72',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#ffffff',
      }
    })
    
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    
    term.open(terminalRef.current)
    fitAddon.fit()
    
    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Bulletproof Paste Logic
    let lastPaste = 0;
    const handleContextMenu = async (e: MouseEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      const now = Date.now();
      if (now - lastPaste < 200) return; // Debounce 200ms
      lastPaste = now;

      try {
        let text = await navigator.clipboard.readText();
        if (text) {
          // Normalize all newlines (\r\n or \n) to just \r
          // This prevents the "double enter" effect where SSH sees \r and \n as two separate commands
          text = text.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
          
          // Ensure we don't send multiple trailing newlines
          if (text.endsWith('\r')) {
            text = text.trimEnd() + '\r';
          }
          
          window.api.sshInput(sessionId, text);
        }
      } catch (err) {
        console.error('Failed to paste:', err);
      }
    };

    const handleNativePaste = (e: ClipboardEvent) => {
      // Block all native paste attempts to avoid duplication with our custom logic
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    const terminalEl = terminalRef.current;
    terminalEl?.addEventListener('contextmenu', handleContextMenu, true);
    terminalEl?.addEventListener('paste', handleNativePaste as any, true);

    // Copy on Select
    term.onSelectionChange(() => {
      const selection = term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    });

    // Send keystrokes to main process
    term.onData(data => {
      window.api.sshInput(sessionId, data)
    })

    // Resize handler
    const handleResize = () => {
      if (isActive && !isHidden && fitAddonRef.current) {
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
      } else if (status === 'reconnecting') {
        term.write('\r\n\x1b[33;1m[Connection lost. Reconnecting...]\r\n')
      } else if (status === 'connected') {
        term.write('\x1b[32;1m[Reconnected!]\x1b[0m\r\n')
      }
    })

    return () => {
      window.removeEventListener('resize', handleResize)
      terminalEl?.removeEventListener('contextmenu', handleContextMenu, true)
      terminalEl?.removeEventListener('paste', handleNativePaste as any, true)
      window.api.removeSshListeners(sessionId)
      term.dispose()
    }
  }, [sessionId]) // Run once per session

  // Refit when becoming active and NOT hidden
  useEffect(() => {
    if (isActive && !isHidden && fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit()
          window.api.sshResize(sessionId, xtermRef.current!.cols, xtermRef.current!.rows)
        }
      }, 50)
    }
  }, [isActive, isHidden, sessionId])

  return (
    <div className={`terminal-container ${isActive && !isHidden ? 'active' : ''}`}>
      <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
})

export default TerminalView
