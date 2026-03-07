"use client"
import React, { Suspense, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle2, BookOpen, Lightbulb, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter, useSearchParams } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@clerk/nextjs';
import { getDocumentation, completeNode, type Documentation } from '@/lib/agents-api';

function LearnContent() {
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

  useEffect(() => {
    if (!nodeId) return;

    let cancelled = false;
    const fetchDoc = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        // This will now generate on-demand if missing in the backend
        const res = await getDocumentation(nodeId, token ?? undefined);
        if (!cancelled && res.documentation) {
          setDoc(res.documentation);
        }
      } catch (err) {
        console.error("Failed to load documentation:", err);
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
          <p className="text-muted-foreground animate-pulse">Generating your learning module...</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Failed to load documentation. Please try again.</p>
          <Button onClick={() => router.push('/roadmap')}>Return to Roadmap</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0 bg-background/80 backdrop-blur z-10 shadow-sm max-w-5xl w-full mx-auto mt-6 rounded-t-xl border-x border-t">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <BookOpen className="text-white h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Learning Module</h1>
            <p className="text-xs text-muted-foreground">Concept Deep Dive</p>
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

      {/* Content Body */}
      <ScrollArea className="flex-1 max-w-5xl w-full mx-auto bg-card rounded-b-xl border-x border-b shadow-md mb-8 z-10">
         <div className="p-10 max-w-3xl mx-auto space-y-10">
           
           <div className="space-y-4">
             <div className="flex items-center gap-2 text-blue-400">
                <Lightbulb className="h-6 w-6" />
                <h2 className="text-2xl font-semibold">Overview</h2>
             </div>
             <p className="text-muted-foreground leading-relaxed text-lg bg-blue-500/5 p-6 border-l-4 border-blue-500 rounded-r-xl">
               {doc.explanation}
             </p>
           </div>

           <Separator />

           {doc.algorithm_steps && doc.algorithm_steps.length > 0 && (
             <div className="space-y-4">
               <h3 className="text-xl font-semibold">Step-by-Step Breakdown</h3>
               <ul className="space-y-4 text-muted-foreground">
                 {doc.algorithm_steps.map((step, i) => (
                   <li key={i} className="flex gap-4 items-start bg-muted/20 p-4 rounded-xl border border-border/50">
                     <span className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-500/20 text-blue-400 font-bold shrink-0">
                       {i + 1}
                     </span>
                     <p className="leading-relaxed pt-1 whitespace-pre-wrap">{step}</p>
                   </li>
                 ))}
               </ul>
             </div>
           )}

           {doc.learning_focus && doc.learning_focus.length > 0 && (
             <div className="bg-muted/30 p-6 rounded-xl border border-border/50">
               <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">Key Takeaways & Details</h4>
               <ul className="space-y-3 list-disc list-inside text-muted-foreground">
                 {doc.learning_focus.map((p, i) => (
                   <li key={i} className="leading-relaxed">{p}</li>
                 ))}
               </ul>
             </div>
           )}

           {doc.common_mistakes && doc.common_mistakes.length > 0 && (
             <div className="space-y-4">
               <h3 className="text-xl font-semibold text-orange-400">Common Mistakes to Avoid</h3>
               <ul className="space-y-3 text-muted-foreground bg-orange-500/5 p-6 rounded-xl border border-orange-500/20 list-disc list-inside">
                 {doc.common_mistakes.map((mistake, i) => (
                   <li key={i} className="leading-relaxed">{mistake}</li>
                 ))}
               </ul>
             </div>
           )}

           {doc.implementation_strategy && doc.implementation_strategy.length > 0 && (
             <div className="space-y-4">
               <h3 className="text-xl font-semibold text-green-400">Implementation Strategy</h3>
               <ul className="space-y-3 text-muted-foreground bg-green-500/5 p-6 rounded-xl border border-green-500/20 list-disc list-inside">
                 {doc.implementation_strategy.map((strategy, i) => (
                   <li key={i} className="leading-relaxed">{strategy}</li>
                 ))}
               </ul>
             </div>
           )}

         </div>
      </ScrollArea>
    </div>
  )
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <LearnContent />
    </Suspense>
  )
}
