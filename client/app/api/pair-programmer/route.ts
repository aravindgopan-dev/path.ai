import { NextRequest, NextResponse } from "next/server";
import {
  generateLevelCode,
  type CodeGenerationRequest,
} from "@/lib/agents/pair-programmer";

/**
 * POST /api/pair-programmer
 * Generates code, pseudo-code, and signatures for a learning level
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { levelTitle, levelDescription, files, validationCriteria } = body;

    // Validate required fields
    if (!levelTitle || !levelDescription || !files || !validationCriteria) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: levelTitle, levelDescription, files, validationCriteria",
        },
        { status: 400 }
      );
    }

    const codeGenerationRequest: CodeGenerationRequest = {
      levelTitle,
      levelDescription,
      files,
      validationCriteria,
    };

    const response = await generateLevelCode(codeGenerationRequest);

    return NextResponse.json({
      success: true,
      data: response,
      message: "Code generated successfully",
    });
  } catch (error) {
    console.error("[Pair-Programmer] API Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
