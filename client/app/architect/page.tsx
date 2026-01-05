"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, CheckCircle2, X } from "lucide-react";

interface Feature {
  id: string;
  name: string;
  description: string;
  category?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type AppState = "initial" | "features" | "confirmation" | "chat" | "finalized";

interface ProjectSpec {
  projectName: string;
  description: string;
  features: Feature[];
  designerInput: {
    nodes: unknown[];
  };
  projectMarkdown: string;
}

export default function ArchitectPage() {
  const router = useRouter();

  const [appState, setAppState] = useState<AppState>("initial");
  const [projectIdea, setProjectIdea] = useState("");
  const [projectName, setProjectName] = useState("");
  const [allFeatures, setAllFeatures] = useState<Feature[]>([]);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(new Set());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalSpec, setFinalSpec] = useState<ProjectSpec | null>(null);

  const handleStartProject = async () => {
    if (!projectIdea.trim()) {
      setError("Please describe your project idea");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/architect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process-idea",
          idea: projectIdea,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process idea");
      }

      const data = await response.json();
      setAllFeatures(data.features || []);

      if (data.features && data.features.length > 0) {
        const allIds = new Set<string>(data.features.map((f: Feature) => f.id));
        setSelectedFeatureIds(allIds);
      }

      const autoName = projectIdea.split(" ").slice(0, 3).join(" ");
      setProjectName(autoName);
      setAppState("features");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error starting project:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFeature = (featureId: string) => {
    const newSelected = new Set(selectedFeatureIds);
    if (newSelected.has(featureId)) {
      newSelected.delete(featureId);
    } else {
      newSelected.add(featureId);
    }
    setSelectedFeatureIds(newSelected);
  };

  const handleAddCustomFeature = (name: string, description: string) => {
    if (!name.trim()) return;

    const id = `custom-${Date.now()}-${name.toLowerCase().replace(/\s+/g, "-")}`;
    const newFeature: Feature = {
      id,
      name: name.trim(),
      description: description.trim() || "Custom feature",
    };

    setAllFeatures([...allFeatures, newFeature]);
    setSelectedFeatureIds(new Set([...selectedFeatureIds, id]));
  };

  const handleRemoveFeature = (featureId: string) => {
    setAllFeatures(allFeatures.filter((f) => f.id !== featureId));
    const newSelected = new Set(selectedFeatureIds);
    newSelected.delete(featureId);
    setSelectedFeatureIds(newSelected);
  };

  const handleProceedToConfirmation = () => {
    if (selectedFeatureIds.size === 0) {
      setError("Please select at least one feature");
      return;
    }
    setError(null);
    setAppState("confirmation");
  };

  const handleFinalize = async () => {
    if (!projectName.trim()) {
      setError("Please enter a project name");
      return;
    }

    if (selectedFeatureIds.size === 0) {
      setError("Please select at least one feature");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const selectedFeatures = allFeatures.filter((f) => selectedFeatureIds.has(f.id));

      const response = await fetch("/api/architect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          projectName,
          selectedFeatures,
          originalIdea: projectIdea,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to finalize project");
      }

      const data = await response.json();
      setFinalSpec(data.spec);
      console.log("[Architect] Final Specification:", data.spec);
      setAppState("finalized");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error finalizing project:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToDesigner = () => {
    if (!finalSpec) return;

    // Store spec in sessionStorage instead of URL params
    if (typeof window !== "undefined") {
      sessionStorage.setItem("projectSpec", JSON.stringify(finalSpec));
    }

    router.push("/designer");
  };

  const handleReset = () => {
    setAppState("initial");
    setProjectIdea("");
    setProjectName("");
    setAllFeatures([]);
    setSelectedFeatureIds(new Set());
    setChatMessages([]);
    setChatInput("");
    setError(null);
    setFinalSpec(null);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Initial State */}
        {appState === "initial" && (
          <div className="flex items-center justify-center min-h-[80vh]">
            <Card className="w-full max-w-md p-8">
              <div className="space-y-6">
                <div>
                  <h1 className="text-4xl font-bold mb-2">Project Architect</h1>
                  <p className="text-muted-foreground">
                    Convert your idea into a structured project with AI
                  </p>
                </div>

                <Textarea
                  placeholder="Describe what you want to build..."
                  value={projectIdea}
                  onChange={(e) => setProjectIdea(e.target.value)}
                  className="min-h-[150px]"
                />

                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleStartProject}
                  disabled={isLoading || !projectIdea.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    "Start Project"
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Feature Selection State */}
        {appState === "features" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold">Feature Selection</h1>
                <p className="text-muted-foreground mt-2">
                  Choose features and customize your project
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleReset} disabled={isLoading}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Card className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Awesome Project"
                  className="text-base"
                />
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Features</h3>

                {allFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-start gap-3 p-4 rounded border border-border hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedFeatureIds.has(feature.id)}
                      onCheckedChange={() => toggleFeature(feature.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{feature.name}</div>
                      <div className="text-sm text-muted-foreground">{feature.description}</div>
                    </div>
                    {feature.id.startsWith("custom-") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFeature(feature.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <div className="mt-6 pt-4 border-t">
                  <CustomFeatureInput onAdd={handleAddCustomFeature} />
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
                  {error}
                </div>
              )}
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleProceedToConfirmation}
                disabled={isLoading || selectedFeatureIds.size === 0}
                className="flex-1"
              >
                Review & Finalize
              </Button>
            </div>
          </div>
        )}

        {/* Confirmation State */}
        {appState === "confirmation" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold">Confirm Project</h1>
                <p className="text-muted-foreground mt-2">Review your project settings</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAppState("features")}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Project Name</h3>
                  <p className="text-muted-foreground">{projectName}</p>
                  <Button
                    variant="link"
                    className="mt-2 h-auto p-0"
                    onClick={() => setAppState("features")}
                  >
                    Edit
                  </Button>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-4">Selected Features</h3>
                  <ul className="space-y-2">
                    {allFeatures
                      .filter((f) => selectedFeatureIds.has(f.id))
                      .map((f) => (
                        <li key={f.id} className="flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-medium">{f.name}</div>
                            <div className="text-sm text-muted-foreground">{f.description}</div>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
                  {error}
                </div>
              )}
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setAppState("features")} disabled={isLoading}>
                Back
              </Button>
              <Button onClick={handleFinalize} disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Specification"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Finalized State */}
        {appState === "finalized" && finalSpec && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <h1 className="text-4xl font-bold">Project Ready</h1>
                <p className="text-muted-foreground">Your specification is ready for design</p>
              </div>
            </div>

            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg">Project Name</h3>
                  <p className="text-muted-foreground">{finalSpec.projectName}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Features ({finalSpec.features.length})</h3>
                  <ul className="space-y-2">
                    {finalSpec.features.map((f) => (
                      <li key={f.id} className="text-sm">
                        <span className="font-medium">{f.name}</span> -{" "}
                        <span className="text-muted-foreground">{f.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} disabled={isLoading}>
                Start New Project
              </Button>
              <Button onClick={handleProceedToDesigner} disabled={isLoading} className="flex-1">
                Proceed to Design
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CustomFeatureInputProps {
  onAdd: (name: string, description: string) => void;
}

function CustomFeatureInput({ onAdd }: CustomFeatureInputProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name, description);
      setName("");
      setDescription("");
    }
  };

  return (
    <div className="space-y-3 p-4 border-2 border-dashed border-border rounded">
      <label className="block text-sm font-medium">Add Custom Feature</label>
      <Input
        placeholder="Feature name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            handleSubmit();
          }
        }}
      />
      <Input
        placeholder="Brief description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            handleSubmit();
          }
        }}
      />
      <Button
        onClick={handleSubmit}
        disabled={!name.trim()}
        size="sm"
        className="w-full"
      >
        Add Feature
      </Button>
    </div>
  );
}


