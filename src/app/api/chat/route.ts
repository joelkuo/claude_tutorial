import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { streamText } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";

export async function POST(req: Request) {
  const {
    messages,
    files,
    projectId,
  }: { messages: any[]; files: Record<string, FileNode>; projectId?: string } =
    await req.json();

  // Validate API key early
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "ANTHROPIC_API_KEY is not configured. Please add your API key to the environment variables.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  messages.unshift({
    role: "system",
    content: generationPrompt,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  });

  // Reconstruct the VirtualFileSystem from serialized data
  const fileSystem = new VirtualFileSystem();
  fileSystem.deserializeFromNodes(files);

  try {
    const model = getLanguageModel();
    const result = streamText({
      model,
      messages,
      maxTokens: 10_000,
      maxSteps: 40,
      onError: (err: any) => {
        console.error("AI SDK Error:", err);
      },
      tools: {
        str_replace_editor: buildStrReplaceTool(fileSystem),
        file_manager: buildFileManagerTool(fileSystem),
      },
      onFinish: async ({ response }) => {
        // Save to project if projectId is provided and user is authenticated
        if (projectId) {
          try {
            // Check if user is authenticated
            const session = await getSession();
            if (!session) {
              console.error("User not authenticated, cannot save project");
              return;
            }

            // Get the messages from the response
            const responseMessages = response.messages || [];
            // Combine original messages with response messages (manually append since appendResponseMessages was removed in v6)
            const allMessages = [
              ...messages.filter((m) => m.role !== "system"),
              ...responseMessages,
            ];

            await prisma.project.update({
              where: {
                id: projectId,
                userId: session.userId,
              },
              data: {
                messages: JSON.stringify(allMessages),
                data: JSON.stringify(fileSystem.serialize()),
              },
            });
          } catch (error) {
            console.error("Failed to save project data:", error);
          }
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "An error occurred while processing your request. Please check that your ANTHROPIC_API_KEY is valid.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const maxDuration = 120;
