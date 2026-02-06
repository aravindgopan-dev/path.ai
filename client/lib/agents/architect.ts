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

export interface Level {
  level: number;
  title: string;
  description: string;
  files: string[];
  completed?: boolean;
  locked?: boolean;
}

export interface ProjectSpec {
  projectName: string;
  description: string;
  features: Feature[];
  levels: Level[];
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

PHASE 2: STRUCTURE & LEVEL GENERATION
====================================

You will receive:
- Project name and description
- FINAL SELECTED FEATURES (from user selection)

Your task:
1. Design a sequence of learning "levels" (roadmap) for the project.
2. Use selected features as PRIMARY INPUT to design the file structure.
3. Generate a realistic, convention-based file tree.
4. Create BOTH frontend and backend sections (unless explicitly feature-disabled).
5. Each node in file tree MUST have:
   - name: string
   - type: "file" | "directory"
   - description: string (ONE LINE, hover-text in UI)
   - children: TreeNode[] (if directory)

LEVEL (ROADMAP) GENERATION RULES:
- Generate AT LEAST 30 sequential levels (tasks).
- Tasks MUST be granular and low-level milestones.
- INITIAL LEVELS (1-10) MUST include these specific steps in order:
  1. Initialize project structure and setup README/documentation.
  2. Create .env file for environment variables and .env.example.
  3. Setup package.json with necessary scripts and dependencies.
  4. Initialize Express server entry point.
  5. Setup environment variable loading and Port configuration.
  6. Create 'database' or 'db' folder structure.
  7. Install and import Mongoose/database driver.
  8. Setup database connection logic and error handling.
  9. ...continue with other feature-specific base setups.
- Each level should represent a SINGLE low-level technical milestone.
- Each level MUST have:
  - level: number (sequential starting from 1)
  - title: string (short, descriptive)
  - description: string (Detailed technical action taken in this level)
  - files: string[] (The EXACT files created or modified in this level)
- Ensure levels logically follow the building process (Init -> DB -> Models -> Auth -> Features -> Polish).
- DO NOT skip steps. Break down features into multiple micro-levels.

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

BACKEND STRUCTURE (Always included unless feature-disabled):
/src/modules           - Feature modules (auth, users, posts, etc.)
/src/config            - Configuration files
/src/middleware        - Global middleware
/src/utils             - Utility functions
/src/database          - Database setup, migrations, seeds
/main.ts or /server.ts - Entry point

STRUCTURE GENERATION RULES:
- Minimum 30-50 nodes (realistic starter project)
- Adapt structure directly based on selected features
- ALL directories must have "children" arrays, even if empty
- Nest children properly - do not flatten the structure

OUTPUT FORMAT (STRICT JSON, NO MARKDOWN):
{
  "projectName": "string",
  "description": "string (2-3 sentence)",
  "features": [array from input],
  "levels": [
    {
      "level": 1,
      "title": "Project Setup",
      "description": "Initialize the project and setup basic structure",
      "files": ["package.json", "tsconfig.json"]
    }
    // ... more levels
  ],
  "designerInput": {
    "nodes": [
      {
        "name": "package.json",
        "type": "file",
        "description": "Project dependencies"
      },
      {
        "name": "frontend",
        "type": "directory",
        "description": "Frontend application",
        "children": [
          {
            "name": "app",
            "type": "directory",
            "description": "Next.js pages",
            "children": [
              { "name": "page.tsx", "type": "file", "description": "Home page" }
            ]
          }
        ]
      }
    ]
  },
  "projectMarkdown": "markdown summary"
}

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
    "nodes": [
      {
        "name": "package.json",
        "type": "file",
        "description": "Project dependencies"
      },
      {
        "name": "frontend",
        "type": "directory",
        "description": "Frontend application",
        "children": [
          {
            "name": "app",
            "type": "directory",
            "description": "Next.js pages",
            "children": [
              { "name": "page.tsx", "type": "file", "description": "Home page" }
            ]
          }
        ]
      }
    ]
  },
  "projectMarkdown": "markdown summary"
}

CRITICAL: Directories MUST have a "children" array with nested TreeNode objects. Do NOT create a flat structure.

Critical output rules:
- Respond with a single valid JSON object only
- The response must start with '{' and end with '}'
- Do not include explanations or formatting
- Do not include markdown or backticks
- All strings must be properly escaped
- ALL directories must have "children" arrays, even if empty
- Nest children properly - do not flatten the structure

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

// Removed hardcoded structure generation to prioritize AI-driven results.

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

      // Use selectedFeatures directly - LLM response features might be incomplete
      parsedSpec.features = selectedFeatures;
    } else {
      throw new Error("Failed to parse AI response as JSON");
    }

    return parsedSpec as ProjectSpec;
  } catch (error) {
    console.error("Error generating final spec:", error);
    throw error;
  }
}
