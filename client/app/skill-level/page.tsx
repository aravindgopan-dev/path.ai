"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DotPattern } from "@/components/ui/dot-pattern";
import {
  Sparkles,
  Zap,
  Rocket,
  ArrowRight,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { assessSkills, type Skill } from "@/lib/agents-api";
import { cn } from "@/lib/utils";

const LEVELS = [
  {
    key: "beginner",
    label: "Beginner",
    icon: Sparkles,
    color: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 hover:border-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    description:
      "I'm just starting out. I know the basics of programming and want guided, step-by-step learning.",
  },
  {
    key: "intermediate",
    label: "Intermediate",
    icon: Zap,
    color: "from-blue-500/20 to-blue-600/5 border-blue-500/30 hover:border-blue-400",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    description:
      "I have solid fundamentals. I've built small projects and want to level up with real-world patterns.",
  },
  {
    key: "pro",
    label: "Pro",
    icon: Rocket,
    color: "from-purple-500/20 to-purple-600/5 border-purple-500/30 hover:border-purple-400",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    description:
      "I'm experienced. I want advanced architecture challenges and production-grade best practices.",
  },
] as const;

export default function SkillLevelPage() {
  const router = useRouter();

  const blueprint = useAppStore((s) => s.blueprint);
  const setUserLevel = useAppStore((s) => s.setUserLevel);
  const setSuggestedSkills = useAppStore((s) => s.setSuggestedSkills);

  const [selected, setSelected] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<"level" | "skills">("level");
  const [error, setError] = useState<string | null>(null);

  // ── Pick level & fetch skills ──────────────────
  const handleSelectLevel = async (level: string) => {
    setSelected(level);
    setUserLevel(level);
  };

  const handleConfirmLevel = async () => {
    if (!selected || !blueprint) return;

    setIsLoading(true);
    setError(null);

    try {
      const { skills: fetchedSkills } = await assessSkills({
        blueprint,
        user_level: selected,
      });

      setSkills(fetchedSkills);
      // Pre-select all
      setSelectedSkillIds(new Set(fetchedSkills.map((s) => s.id)));
      setPhase("skills");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSkill = (id: string) => {
    const next = new Set(selectedSkillIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSkillIds(next);
  };

  const handleProceedToRoadmap = () => {
    const finalSkills = skills.filter((s) => selectedSkillIds.has(s.id));
    setSuggestedSkills(finalSkills);
    router.push("/roadmap");
  };

  // Guard — redirect if no blueprint
  if (!blueprint) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">No Blueprint Found</h2>
          <p className="text-muted-foreground">
            Please start a new project in the Architect first.
          </p>
          <Button onClick={() => router.push("/architect")}>
            Go to Architect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background p-6 overflow-hidden">
      <DotPattern width={20} height={20} cx={1} cy={1} cr={1} glow />

      <div className="relative max-w-4xl mx-auto">
        {/* ────────────────────────────────────────
             PHASE 1 — Level Selection
           ──────────────────────────────────────── */}
        {phase === "level" && (
          <div className="space-y-10 py-6">
            <div className="text-center">
              <h1 className="text-5xl font-bold mb-3">Choose Your Level</h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                This helps us tailor the learning path, skill suggestions, and
                roadmap complexity to your experience.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {LEVELS.map((lvl) => {
                const Icon = lvl.icon;
                const isActive = selected === lvl.key;
                return (
                  <Card
                    key={lvl.key}
                    onClick={() => handleSelectLevel(lvl.key)}
                    className={cn(
                      "relative cursor-pointer p-6 transition-all duration-200 bg-gradient-to-b",
                      lvl.color,
                      isActive
                        ? "ring-2 ring-primary scale-[1.03] shadow-lg"
                        : "hover:scale-[1.02]"
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-3 right-3">
                        <Check className="h-5 w-5 text-primary" />
                      </div>
                    )}

                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="p-4 rounded-2xl bg-background/50">
                        <Icon className="h-8 w-8" />
                      </div>
                      <Badge variant="outline" className={cn("text-sm", lvl.badgeClass)}>
                        {lvl.label}
                      </Badge>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {lvl.description}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive text-center">
                {error}
              </div>
            )}

            <div className="flex justify-center">
              <Button
                size="lg"
                className="gap-2 px-10"
                disabled={!selected || isLoading}
                onClick={handleConfirmLevel}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analysing skills…
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────
             PHASE 2 — Skill Cards
           ──────────────────────────────────────── */}
        {phase === "skills" && (
          <div className="space-y-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold">Suggested Skills</h1>
                <p className="text-muted-foreground mt-2">
                  Toggle skills that are relevant to your learning goals
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPhase("level")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {selected}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {selectedSkillIds.size} of {skills.length} selected
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill) => {
                const active = selectedSkillIds.has(skill.id);
                return (
                  <Card
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                    className={cn(
                      "p-4 cursor-pointer transition-all duration-150 border",
                      active
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors",
                          active
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{skill.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {skill.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
                {error}
              </div>
            )}

            <Separator />

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setPhase("level")}>
                Back
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={selectedSkillIds.size === 0}
                onClick={handleProceedToRoadmap}
              >
                Generate Roadmap
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
