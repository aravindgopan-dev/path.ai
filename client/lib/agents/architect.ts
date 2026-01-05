import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

export interface Feature {
  id: string;
  name: string;
  description: string;
  category?: string;
}

export interface TreeNode {
  name: string;
  type: "file" | "directory";
  language?: string;
  description?: string;
  children?: TreeNode[];
}

export interface DesignerInput {
  nodes: TreeNode[];
}

export interface ProjectSpec {
  projectName: string;
  description: string;
  features: Feature[];
  designerInput: DesignerInput;
  projectMarkdown: string;
}

export interface ArchitectResponse {
  features: Feature[];
  message?: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Initialize the Architect agent
 * Uses Gemini via LangChain with light conversation memory
 */
export function createArchitectAgent() {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.3, // Low temperature for consistent behavior
    apiKey: process.env.GOOGLE_API_KEY,
  });

  return model;
}

const ARCHITECT_SYSTEM_PROMPT = `You are an expert software architect helping learners plan their projects.

PHASE 1: FEATURE RECOMMENDATION
================================

Your role in this phase is to:
1. Analyze the project idea and suggest practical, well-scoped features
2. Suggest 5-8 core features that form the foundation
3. Avoid over-engineering and scope creep
4. Focus on user-facing features and core functionality
5. Format features clearly for UI selection

IMPORTANT: Do NOT generate any file structure in this phase.

When suggesting features, format them EXACTLY as:
1. Feature Name - Brief description (one sentence max)
2. Another Feature - Its description
3. And so on...

Then provide a brief explanation of the project scope.`;

const PHASE_2_SYSTEM_PROMPT_RAW = `You are an expert software architect designing realistic, production-ready project structures.

PHASE 2: STRUCTURE GENERATION
=============================

You will receive:
- Project name and description
- FINAL SELECTED FEATURES (from user selection)

Your task:
1. Use selected features as PRIMARY INPUT to design the file structure
2. Generate a realistic, convention-based file tree
3. Create BOTH frontend and backend sections (unless explicitly feature-disabled)
4. Each node MUST have:
   - name: string
   - type: "file" | "directory"
   - description: string (ONE LINE, hover-text in UI)
   - children: TreeNode[] (if directory)

ADAPTATION RULES (encode in structure):
- Authentication feature → auth module in both frontend and backend
- Real-time/Chat feature → websocket/socket handlers, realtime modules
- Database feature → models, migrations, schema files
- API feature → controllers, routes, services
- UI Components feature → extensive components/ directory
- Admin feature → admin pages, management routes
- Payments feature → payment processing, invoice generation
- Search feature → search services, indexing config
- Analytics feature → tracking, analytics modules
- File Upload feature → upload handlers, storage services

FRONTEND STRUCTURE (Always included unless feature-disabled):
/app or /pages          - Page routes
/components             - Reusable UI components
/features              - Feature-specific components & logic
/hooks                 - Custom React hooks
/services              - API client services
/auth                  - Authentication logic
/styles                - Global styles, themes
/utils                 - Utility functions
/types                 - TypeScript type definitions
/context or /store     - State management
/public                - Static assets
/next.config.ts or /vite.config.ts
/tsconfig.json
/package.json

BACKEND STRUCTURE (Always included unless feature-disabled):
/src/modules           - Feature modules (auth, users, posts, etc.)
  /[module]
    /controller.ts     - Request handlers
    /service.ts        - Business logic
    /repository.ts     - Data access
    /dto.ts            - Data transfer objects
    /routes.ts         - Route definitions
    /middleware.ts     - Middleware
/src/config            - Configuration files
/src/middleware        - Global middleware
/src/utils             - Utility functions
/src/types             - TypeScript definitions
/src/database          - Database setup, migrations, seeds
/src/constants         - Constants
/main.ts or /server.ts - Entry point
/package.json
/.env.example

STRUCTURE GENERATION RULES:
- Minimum 30-50 nodes (realistic starter project)
- Adapt structure directly based on selected features
- Use common naming conventions
- Include key files (package.json, config, entry points)
- Create logical module/feature boundaries
- Add descriptions to EVERY node
- Mirror functionality in both frontend and backend when relevant

OUTPUT FORMAT (STRICT JSON, NO MARKDOWN):
{
  "projectName": "string",
  "description": "string (2-3 sentence)",
  "features": [array from input],
  "designerInput": {
    "nodes": [complete TreeNode[] file tree]
  },
  "projectMarkdown": "markdown summary with architecture and responsibilities"
}

Critical output rules:
- Respond with a single valid JSON object only
- The response must start with '{' and end with '}'
- Do not include explanations or formatting
- Do not include markdown or backticks
- All strings must be properly escaped

The JSON must follow the exact schema provided.
`;

// Escape curly braces to avoid LangChain template parsing errors
const PHASE_2_SYSTEM_PROMPT = PHASE_2_SYSTEM_PROMPT_RAW
  .replace(/\{/g, "{{")
  .replace(/\}/g, "}}");


/**
 * Process the initial project idea and get feature suggestions
 */
export async function processProjectIdea(
  idea: string
): Promise<ArchitectResponse> {
  const model = createArchitectAgent();

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", ARCHITECT_SYSTEM_PROMPT],
    ["human", "User project idea: {idea}"],
  ]);

  const chain = prompt.pipe(model);

  try {
    const response = await chain.invoke({ idea });
    const content =
      response.content || response.text || "No response received";

    // Extract features from the response
    const features = extractFeaturesFromResponse(content as string);

    return {
      features,
      message: content as string,
    };
  } catch (error) {
    console.error("Error processing project idea:", error);
    throw error;
  }
}

/**
 * Continue conversation with the Architect agent
 * Includes conversation history for context
 */
export async function chatWithArchitect(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  originalIdea: string
): Promise<ArchitectResponse> {
  const model = createArchitectAgent();

  // Build conversation history for the prompt
  const historyText = conversationHistory
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n\n");

  const systemPrompt = `${ARCHITECT_SYSTEM_PROMPT}

Original project idea: ${originalIdea}

Conversation history:
${historyText}`;

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["human", "{userMessage}"],
  ]);

  const chain = prompt.pipe(model);

  try {
    const response = await chain.invoke({ userMessage });
    const content =
      response.content || response.text || "No response received";

    // Extract any newly suggested features
    const features = extractFeaturesFromResponse(content as string);

    return {
      features,
      message: content as string,
    };
  } catch (error) {
    console.error("Error chatting with architect:", error);
    throw error;
  }
}

function generateFeaturesMarkdown(features: Feature[]): string {
  return features
    .map((f) => `- **${f.name}**${f.category ? ` (${f.category})` : ""}: ${f.description}`)
    .join("\n");
}

function generateFileStructure(features: Feature[], projectName: string): TreeNode[] {
  const featureNames = features.map((f) => f.name.toLowerCase());

  const hasAuth = featureNames.some((f) => f.includes("auth") || f.includes("login") || f.includes("user"));
  const hasDatabase = featureNames.some((f) => f.includes("database") || f.includes("data") || f.includes("model"));
  const hasRealtime = featureNames.some((f) => f.includes("chat") || f.includes("realtime") || f.includes("websocket"));
  const hasPayments = featureNames.some((f) => f.includes("payment") || f.includes("stripe"));
  const hasSearch = featureNames.some((f) => f.includes("search"));
  const hasAdmin = featureNames.some((f) => f.includes("admin") || f.includes("management"));
  const hasFileUpload = featureNames.some((f) => f.includes("file") || f.includes("upload"));
  const hasAnalytics = featureNames.some((f) => f.includes("analytics") || f.includes("tracking"));

  const safeProjectName = projectName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const nodes: TreeNode[] = [];

  // Root level files
  nodes.push({ name: "package.json", type: "file", description: "Project dependencies and scripts" });
  nodes.push({ name: "tsconfig.json", type: "file", description: "TypeScript configuration" });
  nodes.push({ name: ".env.example", type: "file", description: "Environment variables template" });
  nodes.push({ name: "README.md", type: "file", description: "Project documentation and setup guide" });
  nodes.push({ name: ".gitignore", type: "file", description: "Git ignore rules" });

  // Frontend directory
  const frontendChildren: TreeNode[] = [];

  const appPages: TreeNode[] = [];
  appPages.push({ name: "page.tsx", type: "file", description: "Home page" });
  appPages.push({ name: "layout.tsx", type: "file", description: "Root layout wrapper" });
  if (hasAuth) {
    appPages.push({ name: "login.tsx", type: "file", description: "Login page" });
    appPages.push({ name: "register.tsx", type: "file", description: "Registration page" });
  }
  if (hasAdmin) {
    appPages.push({ name: "admin.tsx", type: "file", description: "Admin dashboard page" });
  }
  appPages.push({ name: "globals.css", type: "file", description: "Global styles" });
  appPages.push({ name: "not-found.tsx", type: "file", description: "404 page" });

  frontendChildren.push({ name: "app", type: "directory", description: "Next.js app directory", children: appPages });

  // Components directory
  const componentsDirs: TreeNode[] = [];
  componentsDirs.push({
    name: "ui", type: "directory", description: "Reusable UI components (button, card, etc)", children: [
      { name: "Button.tsx", type: "file", description: "Button component" },
      { name: "Card.tsx", type: "file", description: "Card container component" },
      { name: "Input.tsx", type: "file", description: "Form input component" },
      { name: "Modal.tsx", type: "file", description: "Modal dialog component" },
    ]
  });

  if (hasAuth) {
    componentsDirs.push({
      name: "auth", type: "directory", description: "Auth-related components", children: [
        { name: "LoginForm.tsx", type: "file", description: "Login form component" },
        { name: "RegisterForm.tsx", type: "file", description: "Registration form component" },
        { name: "ProtectedRoute.tsx", type: "file", description: "Route protection wrapper" },
      ]
    });
  }

  if (hasRealtime) {
    componentsDirs.push({
      name: "chat", type: "directory", description: "Chat components", children: [
        { name: "ChatBox.tsx", type: "file", description: "Chat message display" },
        { name: "MessageInput.tsx", type: "file", description: "Message input field" },
        { name: "ConversationList.tsx", type: "file", description: "List of conversations" },
      ]
    });
  }

  componentsDirs.push({
    name: "common", type: "directory", description: "Common layout components", children: [
      { name: "Header.tsx", type: "file", description: "Page header" },
      { name: "Sidebar.tsx", type: "file", description: "Navigation sidebar" },
      { name: "Footer.tsx", type: "file", description: "Page footer" },
    ]
  });

  frontendChildren.push({ name: "components", type: "directory", description: "React components", children: componentsDirs });

  // Hooks directory
  const hooksChildren: TreeNode[] = [];
  if (hasAuth) {
    hooksChildren.push({ name: "useAuth.ts", type: "file", description: "Authentication hook" });
  }
  if (hasRealtime) {
    hooksChildren.push({ name: "useWebSocket.ts", type: "file", description: "WebSocket connection hook" });
  }
  hooksChildren.push({ name: "useFetch.ts", type: "file", description: "Data fetching hook" });
  frontendChildren.push({ name: "hooks", type: "directory", description: "Custom React hooks", children: hooksChildren });

  // Services directory
  const servicesChildren: TreeNode[] = [];
  const apiServices: TreeNode[] = [];
  if (hasAuth) {
    apiServices.push({ name: "auth.ts", type: "file", description: "Authentication API calls" });
  }
  apiServices.push({ name: "api.ts", type: "file", description: "Base API client" });
  apiServices.push({ name: "users.ts", type: "file", description: "User API calls" });
  servicesChildren.push({ name: "api", type: "directory", description: "API client services", children: apiServices });

  frontendChildren.push({ name: "services", type: "directory", description: "Client services", children: servicesChildren });

  // Context/Store directory
  if (hasAuth) {
    frontendChildren.push({
      name: "context", type: "directory", description: "React context for state", children: [
        { name: "AuthContext.tsx", type: "file", description: "Authentication context provider" },
      ]
    });
  }

  // Utils directory
  frontendChildren.push({
    name: "lib", type: "directory", description: "Utility functions and helpers", children: [
      { name: "utils.ts", type: "file", description: "Common utility functions" },
      { name: "constants.ts", type: "file", description: "App constants" },
    ]
  });

  // Types directory
  frontendChildren.push({
    name: "types", type: "directory", description: "TypeScript type definitions", children: [
      { name: "index.ts", type: "file", description: "Type exports" },
    ]
  });

  // Public directory
  frontendChildren.push({
    name: "public", type: "directory", description: "Static assets", children: [
      { name: "favicon.ico", type: "file", description: "App favicon" },
    ]
  });

  // Config files
  frontendChildren.push({ name: "next.config.ts", type: "file", description: "Next.js configuration" });
  frontendChildren.push({ name: "tailwind.config.ts", type: "file", description: "Tailwind CSS configuration" });

  nodes.push({ name: "frontend", type: "directory", description: "Next.js frontend application", children: frontendChildren });

  // Backend directory
  const backendChildren: TreeNode[] = [];

  // Modules directory
  const modulesChildren: TreeNode[] = [];

  if (hasAuth) {
    const authModuleChildren: TreeNode[] = [
      { name: "auth.controller.ts", type: "file", description: "Authentication endpoints" },
      { name: "auth.service.ts", type: "file", description: "Auth business logic" },
      { name: "auth.middleware.ts", type: "file", description: "Auth middleware" },
      { name: "auth.dto.ts", type: "file", description: "Auth data transfer objects" },
      { name: "jwt.strategy.ts", type: "file", description: "JWT strategy configuration" },
    ];
    modulesChildren.push({ name: "auth", type: "directory", description: "Authentication module", children: authModuleChildren });
  }

  const userModuleChildren: TreeNode[] = [
    { name: "user.controller.ts", type: "file", description: "User endpoints" },
    { name: "user.service.ts", type: "file", description: "User business logic" },
    { name: "user.repository.ts", type: "file", description: "User data access" },
    { name: "user.dto.ts", type: "file", description: "User data transfer objects" },
  ];
  if (hasDatabase) {
    userModuleChildren.push({ name: "user.model.ts", type: "file", description: "User database model" });
  }
  modulesChildren.push({ name: "user", type: "directory", description: "User management module", children: userModuleChildren });

  if (hasRealtime) {
    const chatModuleChildren: TreeNode[] = [
      { name: "chat.controller.ts", type: "file", description: "Chat endpoints" },
      { name: "chat.service.ts", type: "file", description: "Chat business logic" },
      { name: "chat.gateway.ts", type: "file", description: "WebSocket gateway" },
      { name: "chat.dto.ts", type: "file", description: "Chat data transfer objects" },
    ];
    if (hasDatabase) {
      chatModuleChildren.push({ name: "message.model.ts", type: "file", description: "Message database model" });
    }
    modulesChildren.push({ name: "chat", type: "directory", description: "Real-time chat module", children: chatModuleChildren });
  }

  if (hasPayments) {
    const paymentModuleChildren: TreeNode[] = [
      { name: "payment.controller.ts", type: "file", description: "Payment endpoints" },
      { name: "payment.service.ts", type: "file", description: "Payment processing" },
      { name: "payment.dto.ts", type: "file", description: "Payment data objects" },
      { name: "stripe.config.ts", type: "file", description: "Stripe configuration" },
    ];
    modulesChildren.push({ name: "payment", type: "directory", description: "Payment processing module", children: paymentModuleChildren });
  }

  if (hasSearch) {
    const searchModuleChildren: TreeNode[] = [
      { name: "search.controller.ts", type: "file", description: "Search endpoints" },
      { name: "search.service.ts", type: "file", description: "Search logic" },
      { name: "search.index.ts", type: "file", description: "Search indexing" },
    ];
    modulesChildren.push({ name: "search", type: "directory", description: "Search functionality module", children: searchModuleChildren });
  }

  if (hasFileUpload) {
    const uploadModuleChildren: TreeNode[] = [
      { name: "upload.controller.ts", type: "file", description: "File upload endpoints" },
      { name: "upload.service.ts", type: "file", description: "File upload logic" },
      { name: "storage.config.ts", type: "file", description: "Storage configuration" },
    ];
    modulesChildren.push({ name: "upload", type: "directory", description: "File upload module", children: uploadModuleChildren });
  }

  if (hasAnalytics) {
    const analyticsModuleChildren: TreeNode[] = [
      { name: "analytics.controller.ts", type: "file", description: "Analytics endpoints" },
      { name: "analytics.service.ts", type: "file", description: "Analytics processing" },
      { name: "tracking.ts", type: "file", description: "Event tracking" },
    ];
    modulesChildren.push({ name: "analytics", type: "directory", description: "Analytics module", children: analyticsModuleChildren });
  }

  backendChildren.push({ name: "modules", type: "directory", description: "Feature modules", children: modulesChildren });

  // Database directory
  if (hasDatabase) {
    const dbChildren: TreeNode[] = [
      { name: "index.ts", type: "file", description: "Database connection setup" },
      { name: "schema.ts", type: "file", description: "Database schema definition" },
      {
        name: "migrations", type: "directory", description: "Database migrations", children: [
          { name: "001_initial.ts", type: "file", description: "Initial migration" },
        ]
      },
      {
        name: "seeds", type: "directory", description: "Database seeders", children: [
          { name: "seed.ts", type: "file", description: "Seed initial data" },
        ]
      },
    ];
    backendChildren.push({ name: "database", type: "directory", description: "Database setup and migrations", children: dbChildren });
  }

  // Config directory
  const configChildren: TreeNode[] = [
    { name: "env.ts", type: "file", description: "Environment variables" },
    { name: "database.ts", type: "file", description: "Database configuration" },
  ];
  if (hasRealtime) {
    configChildren.push({ name: "websocket.ts", type: "file", description: "WebSocket configuration" });
  }
  backendChildren.push({ name: "config", type: "directory", description: "Application configuration", children: configChildren });

  // Middleware directory
  const middlewareChildren: TreeNode[] = [
    { name: "errorHandler.ts", type: "file", description: "Error handling middleware" },
    { name: "logging.ts", type: "file", description: "Request logging middleware" },
    { name: "cors.ts", type: "file", description: "CORS middleware" },
    { name: "validation.ts", type: "file", description: "Request validation" },
  ];
  backendChildren.push({ name: "middleware", type: "directory", description: "Global middleware", children: middlewareChildren });

  // Utils directory
  const backendUtilsChildren: TreeNode[] = [
    { name: "helpers.ts", type: "file", description: "Utility helper functions" },
    { name: "validators.ts", type: "file", description: "Validation utilities" },
    { name: "logger.ts", type: "file", description: "Logging utility" },
  ];
  backendChildren.push({ name: "utils", type: "directory", description: "Utility functions", children: backendUtilsChildren });

  // Constants directory
  backendChildren.push({
    name: "constants", type: "directory", description: "Application constants", children: [
      { name: "index.ts", type: "file", description: "Exported constants" },
    ]
  });

  // Types directory
  backendChildren.push({
    name: "types", type: "directory", description: "TypeScript definitions", children: [
      { name: "index.ts", type: "file", description: "Type exports" },
    ]
  });

  // Server entry points
  backendChildren.push({ name: "main.ts", type: "file", description: "Express server entry point" });
  backendChildren.push({ name: "server.ts", type: "file", description: "Server initialization" });

  nodes.push({ name: "backend", type: "directory", description: "Express/Node.js backend API", children: backendChildren });

  // Docker files
  nodes.push({ name: "Dockerfile", type: "file", description: "Docker configuration" });
  nodes.push({ name: "docker-compose.yml", type: "file", description: "Docker Compose services" });

  return nodes;
}

function buildProjectMarkdown(
  projectName: string,
  description: string,
  features: Feature[],
  fileStructure: TreeNode[]
): string {
  const featuresMarkdown = generateFeaturesMarkdown(features);
  const structureMarkdown = formatTreeForMarkdown(fileStructure, 0);

  const featureNames = features.map((f) => f.name.toLowerCase());
  const hasAuth = featureNames.some((f) => f.includes("auth") || f.includes("login"));
  const hasDatabase = featureNames.some((f) => f.includes("database") || f.includes("data"));
  const hasRealtime = featureNames.some((f) => f.includes("chat") || f.includes("realtime"));

  let architectureSection = "";
  if (hasAuth && hasDatabase && hasRealtime) {
    architectureSection = `## Architecture

This is a full-stack application with the following architecture:

- **Frontend**: Next.js React application with TypeScript
- **Backend**: Express.js REST API
- **Database**: Relational database with migrations
- **Real-time**: WebSocket support for live features
- **Authentication**: JWT-based auth with secure session management

### Key Modules

**Authentication Module**: Handles user login, registration, and token management
**User Module**: Manages user profiles and data
**Chat Module**: Real-time messaging with WebSocket
**Database Layer**: Migrations, seeders, and schema definition
`;
  } else if (hasAuth && hasDatabase) {
    architectureSection = `## Architecture

This is a full-stack application with:

- **Frontend**: Next.js React application
- **Backend**: Express.js REST API
- **Database**: Schema with migrations
- **Authentication**: JWT-based authentication

### Key Modules

**Auth Module**: User authentication and authorization
**User Module**: User management
**Database**: Schema migrations and seeds
`;
  } else {
    architectureSection = `## Architecture

- **Frontend**: Next.js React application with TypeScript
- **Backend**: Express.js API
`;
  }

  return `# ${projectName}

## Overview

${description}

## Features

${featuresMarkdown}

${architectureSection}

## Project Structure

\`\`\`
${structureMarkdown}
\`\`\`

## Directory Overview

### Frontend (/frontend)
Contains the Next.js application with components, pages, hooks, and services.

### Backend (/backend)
Contains the Express API with modules, database, config, and middleware.

### Database
Includes schema definitions, migrations, and seeders.

## Getting Started

1. Install dependencies in both frontend and backend: \`npm install\`
2. Configure environment variables: \`.env.example\` → \`.env.local\`
3. Set up database and run migrations
4. Start the development servers: \`npm run dev\`

## Module Structure

Each feature is organized as a self-contained module with:
- Controller: HTTP request handlers
- Service: Business logic
- Repository: Data access (if database)
- DTO: Data transfer objects
- Middleware: Request processing
`;
}

function formatTreeForMarkdown(nodes: TreeNode[], level: number): string {
  return nodes
    .map((node) => {
      const indent = "  ".repeat(level);
      const icon = node.type === "directory" ? "📁" : "📄";
      let line = `${indent}${icon} ${node.name}`;

      if (node.children && node.children.length > 0) {
        line += "\n" + formatTreeForMarkdown(node.children, level + 1);
      }

      return line;
    })
    .join("\n");
}

function extractFeaturesFromResponse(response: string): Feature[] {
  const features: Feature[] = [];
  const lines = response.split("\n");

  // Regex patterns for numbered lists and bullets
  const patterns = [
    /^\d+\.\s*\*\*(.+?)\*\*\s*[-–]\s*(.+?)$/,
    /^\d+\.\s*(.+?)\s*[-–]\s*(.+?)$/,
    /^[-•*]\s*\*\*(.+?)\*\*\s*[-–]\s*(.+?)$/,
    /^[-•*]\s*(.+?)\s*[-–]\s*(.+?)$/,
  ];

  let featureIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const name = match[1].trim();
        const description = match[2].trim();

        const id = `feature-${featureIndex}-${name.toLowerCase().replace(/\s+/g, "-")}`;

        features.push({
          id,
          name,
          description,
        });

        featureIndex++;
        break;
      }
    }
  }

  return features;
}

export async function generateFinalSpec(
  projectName: string,
  description: string,
  selectedFeatures: Feature[]
): Promise<ProjectSpec> {
  const model = createArchitectAgent();

  // Build feature list for PHASE 2
  const featuresForPhase2 = selectedFeatures
    .map((f) => `- ${f.name}: ${f.description}`)
    .join("\n");

  const phase2Input = `PROJECT NAME: ${projectName}
DESCRIPTION: ${description}

SELECTED FEATURES:
${featuresForPhase2}

Now design a realistic, feature-driven file structure for this project.`;

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", PHASE_2_SYSTEM_PROMPT],
    ["human", "{input}"],
  ]);

  const chain = prompt.pipe(model);

  try {
    const response = await chain.invoke({ input: phase2Input });
    const content = response.content || response.text || "{}";

    // Extract JSON from response
    let parsedSpec;
    const jsonMatch = (content as string).match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      parsedSpec = JSON.parse(jsonMatch[0]);

      // Ensure features have IDs by mapping back to selectedFeatures
      if (parsedSpec.features && Array.isArray(parsedSpec.features)) {
        parsedSpec.features = parsedSpec.features.map((f: any, index: number) => {
          // Try to find matching feature from selectedFeatures
          const matchingFeature = selectedFeatures.find(
            sf => sf.name.toLowerCase() === f.name?.toLowerCase()
          );

          return {
            ...f,
            id: matchingFeature?.id || f.id || `feature-${index}-${f.name?.toLowerCase().replace(/\s+/g, "-") || index}`,
          };
        });
      }
    } else {
      // Fallback: generate structure locally if LLM response is invalid
      const fileStructure = generateFileStructure(selectedFeatures, projectName);
      const projectMarkdown = buildProjectMarkdown(projectName, description, selectedFeatures, fileStructure);

      parsedSpec = {
        projectName,
        description,
        features: selectedFeatures,
        designerInput: { nodes: fileStructure },
        projectMarkdown,
      };
    }

    return parsedSpec as ProjectSpec;
  } catch (error) {
    console.error("Error generating final spec, using fallback:", error);

    // Fallback to local generation
    const fileStructure = generateFileStructure(selectedFeatures, projectName);
    const projectMarkdown = buildProjectMarkdown(projectName, description, selectedFeatures, fileStructure);

    return {
      projectName,
      description,
      features: selectedFeatures,
      designerInput: { nodes: fileStructure },
      projectMarkdown,
    };
  }
}
