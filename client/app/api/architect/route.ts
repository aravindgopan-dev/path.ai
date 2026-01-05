import { NextRequest, NextResponse } from "next/server";
import {
  processProjectIdea,
  chatWithArchitect,
  generateFinalSpec,
  type Feature,
  type ConversationMessage,
} from "@/lib/agents/architect";

/**
 * POST /api/architect
 * Handles two types of requests:
 * 1. Initial idea processing (action: "process-idea")
 * 2. Chat continuation (action: "chat")
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, idea, message, history, originalIdea, selectedFeatures, projectName, clarifications } = body;

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { error: "Missing 'action' field" },
        { status: 400 }
      );
    }

    // Process initial project idea
    if (action === "process-idea") {
      if (!idea) {
        return NextResponse.json(
          { error: "Missing 'idea' field" },
          { status: 400 }
        );
      }

      const response = await processProjectIdea(idea);

      return NextResponse.json(response);
    }

    // Continue conversation
    if (action === "chat") {
      if (!message) {
        return NextResponse.json(
          { error: "Missing 'message' field" },
          { status: 400 }
        );
      }

      if (!originalIdea) {
        return NextResponse.json(
          { error: "Missing 'originalIdea' field" },
          { status: 400 }
        );
      }

      const conversationHistory: ConversationMessage[] = history || [];

      const response = await chatWithArchitect(
        message,
        conversationHistory,
        originalIdea
      );

      return NextResponse.json(response);
    }

    // Finalize project specification
    if (action === "finalize") {
      if (!projectName || !selectedFeatures || !originalIdea) {
        return NextResponse.json(
          { error: "Missing required fields for finalization" },
          { status: 400 }
        );
      }

      const spec = await generateFinalSpec(
        projectName,
        originalIdea,
        selectedFeatures as Feature[]
      );

      return NextResponse.json({
        success: true,
        spec,
        message: "Project specification generated successfully",
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Architect] API Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
