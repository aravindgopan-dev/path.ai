"use client"

import { useEffect, useRef } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { getSocket } from "@/lib/socket"
import type { Socket } from "socket.io-client"

export function XTerminal() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const currentLineRef = useRef("")

  useEffect(() => {
    if (!terminalRef.current) return

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#ffffff",
      },
      scrollback: 1000,
    })

    // Create and load fit addon
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    // Open terminal in the container
    term.open(terminalRef.current)
    
    // Fit terminal to container with a slight delay to ensure DOM is ready
    setTimeout(() => {
      fitAddon.fit()
    }, 0)

    // Store references
    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Initialize Socket.IO
    socketRef.current = getSocket()
    const socket = socketRef.current

    // Write welcome message
    term.writeln("Welcome to Pair Programmer Terminal!")
    term.writeln("Connected to Node.js backend via Socket.IO")
    term.writeln("")

    // Connection status
    socket.on("connect", () => {
      term.writeln("\x1b[32m✓ Connected to backend\x1b[0m")
      term.write("$ ")
    })

    socket.on("disconnect", () => {
      term.writeln("\x1b[31m✗ Disconnected from backend\x1b[0m")
    })

    // Handle command output from backend
    socket.on("command-output", (data: { type: string; data: string }) => {
      if (data.type === "stderr") {
        term.write(`\x1b[31m${data.data}\x1b[0m`) // Red for stderr
      } else {
        term.write(data.data)
      }
    })

    // Handle command completion
    socket.on("command-complete", (data: { code: number; message: string }) => {
      if (data.code !== 0) {
        term.writeln(`\x1b[33m${data.message}\x1b[0m`) // Yellow for non-zero exit
      }
      term.write("$ ")
      currentLineRef.current = ""
    })

    // Handle command errors
    socket.on("command-error", (data: { error: string }) => {
      term.writeln(`\x1b[31mError: ${data.error}\x1b[0m`)
      term.write("$ ")
      currentLineRef.current = ""
    })

    // If already connected, show prompt
    if (socket.connected) {
      term.write("$ ")
    }

    // Handle data input
    const handleData = (data: string) => {
      const code = data.charCodeAt(0)

      // Handle Enter key
      if (code === 13) {
        term.writeln("")
        
        const command = currentLineRef.current.trim()
        
        if (command) {
          // Send command to backend via Socket.IO
          socket.emit("execute-command", command)
        } else {
          term.write("$ ")
        }
        
        currentLineRef.current = ""
      }
      // Handle Backspace
      else if (code === 127) {
        if (currentLineRef.current.length > 0) {
          currentLineRef.current = currentLineRef.current.slice(0, -1)
          term.write("\b \b")
        }
      }
      // Handle Ctrl+C
      else if (code === 3) {
        term.writeln("^C")
        term.write("$ ")
        currentLineRef.current = ""
      }
      // Handle Ctrl+L (clear screen)
      else if (code === 12) {
        term.clear()
        term.write("$ ")
        currentLineRef.current = ""
      }
      // Handle regular characters
      else if (code >= 32) {
        currentLineRef.current += data
        term.write(data)
      }
    }

    const disposable = term.onData(handleData)

    // Handle window resize with ResizeObserver for better responsiveness
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    // Also handle window resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener("resize", handleResize)

    // Cleanup function
    return () => {
      disposable.dispose()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
      socket.off("connect")
      socket.off("disconnect")
      socket.off("command-output")
      socket.off("command-complete")
      socket.off("command-error")
      term.dispose()
    }
  }, [])

  return <div ref={terminalRef} className="h-full w-full" />
}
