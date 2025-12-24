"use client"

import { useEffect, useRef } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"

export function XTerminal() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

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
      rows: 20,
      cols: 80,
    })

    // Create and load fit addon
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    // Open terminal in the container
    term.open(terminalRef.current)
    
    // Fit terminal to container
    fitAddon.fit()

    // Store references
    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Write welcome message
    term.writeln("Welcome to Pair Programmer Terminal!")
    term.writeln("Type 'help' for available commands")
    term.writeln("")
    term.write("$ ")

    let currentLine = ""

    // Handle data input
    const handleData = (data: string) => {
      const code = data.charCodeAt(0)

      // Handle Enter key
      if (code === 13) {
        term.writeln("")
        
        const command = currentLine.trim()
        if (command === "help") {
          term.writeln("Available commands:")
          term.writeln("  help  - Show this help message")
          term.writeln("  clear - Clear the terminal")
          term.writeln("  echo  - Echo back your message")
        } else if (command === "clear") {
          term.clear()
        } else if (command.startsWith("echo ")) {
          term.writeln(command.substring(5))
        } else if (command) {
          term.writeln(`Command not found: ${command}`)
        }
        
        currentLine = ""
        term.write("$ ")
      }
      // Handle Backspace
      else if (code === 127) {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1)
          term.write("\b \b")
        }
      }
      // Handle regular characters
      else if (code >= 32) {
        currentLine += data
        term.write(data)
      }
    }

    const disposable = term.onData(handleData)

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener("resize", handleResize)

    // Cleanup function
    return () => {
      disposable.dispose()
      window.removeEventListener("resize", handleResize)
      term.dispose()
    }
  }, [])

  return <div ref={terminalRef} className="h-full w-full" />
}
