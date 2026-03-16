"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Layers, Plus, Rocket, Trash2, Loader2, AlertCircle } from "lucide-react";
import { DotPattern } from "@/components/ui/dot-pattern";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getAllProjects, deleteProject, type ProjectInfo } from "@/lib/agents-api";

export default function Dashboard() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; projectId: string | null; projectName: string }>({
    isOpen: false,
    projectId: null,
    projectName: "",
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch projects on mount
  useEffect(() => {
    let cancelled = false;
    const fetchProjects = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const { projects: fetchedProjects } = await getAllProjects(token ?? undefined);
        if (!cancelled) {
          setProjects(fetchedProjects);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load projects");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchProjects();
    return () => { cancelled = true; };
  }, [getToken]);

  const handleOpenDeleteModal = (projectId: string, projectName: string) => {
    setDeleteModal({
      isOpen: true,
      projectId,
      projectName,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.projectId) return;
    
    setIsDeleting(true);
    try {
      const token = await getToken();
      await deleteProject(deleteModal.projectId, token ?? undefined);
      
      // Remove from local state
      setProjects(projects.filter(p => p.id !== deleteModal.projectId));
      setDeleteModal({ isOpen: false, projectId: null, projectName: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProjectClick = (projectId: string) => {
    // Navigate to roadmap with project_id
    router.push(`/roadmap?projectId=${projectId}`);
  };

  const calculateProgress = (project: ProjectInfo): number => {
    // Placeholder: actual progress would come from backend
    // For now, return a fixed progress based on project name
    return Math.floor(Math.random() * 70) + 10; // 10-80%
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <DotPattern
        width={20}
        height={20}
        cx={1}
        cy={1}
        cr={1}
        glow      />
      {/* Main Content */}
      <main className="relative container mx-auto px-4 py-12 max-w-6xl">
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Your Projects
          </h1>
          <p className="text-muted-foreground text-lg">
            Learn by building. Projects unlock step by step.
          </p>
        </div>

        <Separator className="mb-12" />

        {/* Create Project Section */}
        <Card className="mb-12 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Rocket className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ready to build something new?</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Start a new project and learn by doing. Each project is designed to help you master real-world skills.
            </p>
            <Link href="/architect">
              <Button size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                Create New Project
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="mb-12 border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6 flex gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive mb-1">Error loading projects</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">
              Active Projects
            </h2>
            <p className="text-sm text-muted-foreground">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : projects.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => {
                const progress = calculateProgress(project);
                return (
                  <Card 
                    key={project.id}
                    className="hover:shadow-md transition-shadow group cursor-pointer"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div 
                          className="rounded-lg bg-muted p-2 group-hover:bg-muted/80 transition-colors"
                          onClick={() => handleProjectClick(project.id)}
                        >
                          <Layers className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex gap-2">
                          {project.tech_stack.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {project.tech_stack[0]}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDeleteModal(project.id, project.name);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardTitle 
                        className="text-xl cursor-pointer hover:text-primary/80 transition-colors"
                        onClick={() => handleProjectClick(project.id)}
                      >
                        {project.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {project.description || "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="space-y-2 cursor-pointer"
                        onClick={() => handleProjectClick(project.id)}
                      >
                        {project.tech_stack.length > 1 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {project.tech_stack.slice(0, 3).map((tech) => (
                              <Badge 
                                key={tech} 
                                variant="outline" 
                                className="text-xs"
                              >
                                {tech}
                              </Badge>
                            ))}
                            {project.tech_stack.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{project.tech_stack.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <Button 
                          className="w-full mt-4"
                          onClick={() => handleProjectClick(project.id)}
                        >
                          Continue
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Layers className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                  Get started by creating your first project. Each project comes with guided steps and resources.
                </p>
                <Link href="/architect">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Your First Project
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModal.isOpen} onOpenChange={(open) => {
        if (!open) {
          setDeleteModal({ isOpen: false, projectId: null, projectName: "" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteModal.projectName}"? This action cannot be undone. All project data, roadmap nodes, and progress will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ isOpen: false, projectId: null, projectName: "" })}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Project"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}






