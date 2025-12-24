import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Layers, Plus, Rocket } from "lucide-react";

export default function Dashboard() {
  // Placeholder project data
  const projects = [
    { id: 1, name: "E-Commerce Platform", stack: "MERN", progress: 65 },
    { id: 2, name: "Social Media App", stack: "Next.js + Supabase", progress: 32 },
    { id: 3, name: "Task Management", stack: "React + Firebase", progress: 88 },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-6xl">
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
            <Button size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              Create New Project
            </Button>
          </CardContent>
        </Card>

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

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className="hover:shadow-md transition-shadow cursor-pointer group"
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="rounded-lg bg-muted p-2 group-hover:bg-muted/80 transition-colors">
                      <Layers className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {project.stack}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{project.name}</CardTitle>
                  <CardDescription>
                    Building a production-ready application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Empty State (shown when no projects) */}
        {projects.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Layers className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                Get started by creating your first project. Each project comes with guided steps and resources.
              </p>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}






