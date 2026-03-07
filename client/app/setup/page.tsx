"use client"
import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { getDocumentation, completeNode, type Documentation } from '@/lib/agents-api';

const XTerminal = dynamic(
  () => import("@/components/terminal").then((mod) => ({ default: mod.XTerminal })),
  { ssr: false, loading: () => <div className="flex justify-center items-center h-full text-muted-foreground">Loading Terminal...</div> }
);

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nodeId = searchParams.get("id");
  const { getToken } = useAuth();
  
  const [doc, setDoc] = useState<Documentation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleMarkComplete = async () => {
    if (!nodeId) return;
    try {
      setIsCompleting(true);
      const token = await getToken();
      await completeNode(nodeId, token ?? undefined);
      router.push('/roadmap');
    } catch (err) {
      console.error("Failed to complete node:", err);
    } finally {
      setIsCompleting(false);
    }
  };

  // Note: the backend returns 'setup_commands' embedded in 'instruction_json' or 'documentation_json'.
  // Using the getDocumentation endpoint as a generic fetch wrapper here since we updated our backend.
  useEffect(() => {
    if (!nodeId) return;

    let cancelled = false;
    const fetchDoc = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        const res = await getDocumentation(nodeId, token ?? undefined);
        if (!cancelled && res.documentation) {
          setDoc(res.documentation);
        }
      } catch (err) {
        console.error("Failed to load setup instructions:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchDoc();
    return () => { cancelled = true; };
  }, [nodeId, getToken]);
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground animate-pulse">Loading setup environment...</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Rocket className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Failed to load setup instructions. Please try again.</p>
          <Button onClick={() => router.push('/roadmap')}>Return to Roadmap</Button>
        </div>
      </div>
    );
  }

  // The ROADMAP_SYSTEM guarantees exact linux/bash commands for setup are generated.
  // We'll safely fallback to algorithm_steps if the key was mapped there under the hood.
  const commandsToRun = doc.setup_commands || doc.algorithm_steps || [];

  return (
    <div className="flex h-screen w-full flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
            <Rocket className="text-white h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg">{doc.objective || doc.title || "Project Initialization"}</h1>
            <p className="text-xs text-muted-foreground">Setup Task</p>
          </div>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => router.push('/roadmap')}>Back to Roadmap</Button>
          <Button 
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white gap-2"
            onClick={handleMarkComplete}
            disabled={isCompleting}
          >
            {isCompleting ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>} 
            {isCompleting ? "Completing..." : "Mark Complete"}
          </Button>
        </div>
      </div>

      {/* Main Split View */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        
        {/* Left Side: Documentation */}
        <ResizablePanel defaultSize={40} minSize={30} className="bg-background">
           <ScrollArea className="h-full">
             <div className="p-8 max-w-2xl mx-auto space-y-8">
               
               <div>
                 <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Rocket className="text-purple-400 h-5 w-5" />
                    Instructions
                 </h2>
                 <p className="text-muted-foreground leading-relaxed text-sm bg-muted/20 p-4 rounded-lg border border-border/50">
                    {doc.explanation || "Run the specified commands in the terminal to initialize your project. This will set up the necessary files and dependencies so we can start coding."}
                 </p>
               </div>

               <div>
                 <h3 className="font-semibold text-lg mb-4">Commands to Run</h3>
                 {commandsToRun.length > 0 ? (
                   <ul className="space-y-3 font-mono text-sm">
                     {commandsToRun.map((s: string, i: number) => (
                       <li key={i} className="flex items-center gap-3 bg-muted/30 p-3 rounded-md border border-border/50">
                         <span className="text-muted-foreground select-none">$</span>
                         <span className="text-emerald-400">{s}</span>
                       </li>
                     ))}
                   </ul>
                 ) : (
                   <div className="bg-muted/30 p-4 rounded-md border border-border/50 text-muted-foreground text-sm font-mono">
                     No exact commands provided for this node. Use the terminal to initialize based on instructions.
                   </div>
                 )}
               </div>

             </div>
           </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Side: Terminal */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <div className="h-full bg-[#1e1e1e] flex flex-col">
            <div className="bg-[#2d2d2d] text-xs text-muted-foreground px-4 py-2 border-b border-[#1e1e1e] flex gap-2 items-center">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
              </div>
              <span className="ml-2 font-mono">bash - sandbox</span>
            </div>
            <div className="flex-1 overflow-hidden p-1">
              <XTerminal />
            </div>
          </div>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  )
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><p className="text-muted-foreground">Loading setup environment...</p></div>}>
      <SetupContent />
    </Suspense>
  )
}
