import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

export interface CodeGenerationRequest {
  levelTitle: string;
  levelDescription: string;
  files: string[];
  validationCriteria: string[];
}

export interface FileCode {
  name: string;
  realCode: string;
  pseudoCode: string;
  codeSignature: string;
  language: string;
  description: string;
  isConfigFile?: boolean;
  commandInstructions?: string;
}

export interface CodeGenerationResponse {
  levelTitle: string;
  description: string;
  pseudoCodeExplanation: string;
  files: FileCode[];
  message?: string;
}

/**
 * Initialize the Pair Programmer agent
 * Uses Gemini via LangChain for code generation
 */
export function createPairProgrammerAgent() {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.4, // Slightly higher for more creative code examples
    apiKey: process.env.GOOGLE_API_KEY,
  });

  return model;
}

const PAIR_PROGRAMMER_SYSTEM_PROMPT = `You are an expert code instructor and pair programmer helping learners write code.

Your role is to:
1. Understand the learning level requirements
2. Generate high-quality, production-ready code for the files
3. Create helpful pseudo-code to guide learners
4. Generate partial code with blanks for learners to fill in
5. Provide clear explanations of what needs to be done
6. Handle both code files and configuration files

For configuration files (package.json, .env, tsconfig.json, docker-compose.yml, etc.):
- Generate the complete file content
- Include command instructions if needed (e.g., "npm install", "docker-compose up")
- Mark these as isConfigFile: true

RESPONSE FORMAT (RESPOND WITH VALID JSON ONLY):
You MUST respond with a JSON object containing:
- levelTitle: The level title
- description: Technical explanation of what the learner will accomplish
- pseudoCodeExplanation: Explanation of the pseudo-code approach
- files: Array of file objects, each containing:
  - name: Filename with extension
  - language: Programming language name
  - description: What this file does
  - isConfigFile: Boolean, true for configuration files
  - realCode: Complete production-ready code implementation
  - pseudoCode: Well-structured pseudo-code showing logic flow
  - codeSignature: PARTIAL CODE with blanks (70-80% of user responsibility). Use comments like "// TODO: implement function body here" or "... // FILL THIS IN" to mark missing sections. Keep structure, remove internal logic.
  - commandInstructions: Instructions for running config files (or null)

CRITICAL REQUIREMENTS:
- Respond with ONLY valid JSON, no markdown or backticks
- realCode: Complete, production-ready implementation
- pseudoCode: Show logic flow without implementation details
- codeSignature: Partial code scaffold where user fills 70-80% of logic. Use TODO comments and blank sections strategically. Show imports, function signatures, class definitions, but leave implementation bodies mostly empty or with placeholders.
- All strings must be properly escaped for JSON
- For config files, include command instructions on how to run them
- Do not include any text before or after the JSON object`;



/**
 * Generate code for a learning level
 */
export async function generateLevelCode(
  request: CodeGenerationRequest
): Promise<CodeGenerationResponse> {
  const model = createPairProgrammerAgent();

  const filesDescription = request.files.join(", ");
  const criteriaDescription = request.validationCriteria
    .map((c) => `- ${c}`)
    .join("\n");

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", PAIR_PROGRAMMER_SYSTEM_PROMPT],
    [
      "human",
      `Level: {levelTitle}

Description: {levelDescription}

Files to create/modify:
{filesDescription}

Validation Criteria:
{criteriaDescription}

Generate complete code with real implementation, pseudo-code, and signatures for each file. For configuration files, also include command instructions.`,
    ],
  ]);

  const chain = prompt.pipe(model);

  try {
    const response = await chain.invoke({
      levelTitle: request.levelTitle,
      levelDescription: request.levelDescription,
      filesDescription,
      criteriaDescription,
    });

    const content = response.content || response.text || "{}";

    // Extract JSON from response
    let parsedResponse: CodeGenerationResponse;
    const jsonMatch = (content as string).match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      console.log("[Pair-Programmer] Raw AI Response:", jsonMatch[0]);
      parsedResponse = JSON.parse(jsonMatch[0]);
      console.log("[Pair-Programmer] Parsed Code Response:", parsedResponse);
    } else {
      throw new Error("Failed to parse AI response as JSON");
    }

    return parsedResponse;
  } catch (error) {
    console.error("Error generating level code:", error);
    throw error;
  }
}
