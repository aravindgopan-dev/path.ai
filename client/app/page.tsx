import Link from "next/link";
import { Button } from "@/components/ui/button";
import TextType from "@/components/TextType";
import { ArrowRight, Code2, Sparkles, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Logo/Brand */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Code2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              PATH.ai
            </h1>
          </div>

          {/* Typing Animation */}
          <div className="min-h-[120px] flex items-center justify-center">
            <TextType
              text={[
                "Build full-stack applications with AI",
                "From idea to production in minutes",
                "Your AI-powered development partner",
                "Design, code, and deploy seamlessly"
              ]}
              typingSpeed={75}
              deletingSpeed={40}
              pauseDuration={1500}
              showCursor={true}
              cursorCharacter="|"
              loop={true}
              className="text-3xl md:text-5xl font-bold text-foreground"
            />
          </div>

          {/* Description */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your ideas into reality with our AI-powered development platform. 
            Design architectures, generate code, and build complete applications with intelligent assistance.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Link href="/architect">
              <Button size="lg" className="gap-2 text-lg px-8">
                Start Building
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="gap-2 text-lg px-8">
                View Dashboard
              </Button>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 pt-16">
            <div className="p-6 rounded-xl bg-card border hover:border-primary/50 transition-colors">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI Architect</h3>
              <p className="text-sm text-muted-foreground">
                Design your application architecture with AI-powered suggestions and best practices
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border hover:border-primary/50 transition-colors">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                <Code2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Pair Programmer</h3>
              <p className="text-sm text-muted-foreground">
                Code with AI assistance in a powerful editor with real-time sync and terminal
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border hover:border-primary/50 transition-colors">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Instant Deploy</h3>
              <p className="text-sm text-muted-foreground">
                Generate complete project structures and deploy to production instantly
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
