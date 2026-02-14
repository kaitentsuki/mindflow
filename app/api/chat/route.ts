import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateRAGResponse, generateTitle } from "@/lib/chat";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user && "id" in session.user ? (session.user.id as string) : null;

  if (!userId) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { message, conversationId: existingConvId } = await request.json();

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get or create conversation
  let conversationId = existingConvId;
  let isNewConversation = false;

  if (!conversationId) {
    const conversation = await prisma.conversation.create({
      data: { userId },
    });
    conversationId = conversation.id;
    isNewConversation = true;
  }

  // Save user message
  await prisma.chatMessage.create({
    data: {
      conversationId,
      role: "user",
      content: message.trim(),
    },
  });

  // Stream SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send conversationId first
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "conversation", conversationId })}\n\n`
        ));

        let fullResponse = "";
        for await (const chunk of generateRAGResponse(userId, message.trim(), conversationId)) {
          controller.enqueue(encoder.encode(chunk));
          // Capture full response for title generation
          try {
            const parsed = JSON.parse(chunk.replace("data: ", "").trim());
            if (parsed.type === "text") fullResponse += parsed.content;
          } catch { /* ignore parse errors in non-JSON chunks */ }
        }

        // Auto-title for new conversations (fire and forget)
        if (isNewConversation && fullResponse) {
          generateTitle(message, fullResponse).then(title => {
            prisma.conversation.update({
              where: { id: conversationId },
              data: { title },
            }).catch(() => {});
          });
        }
      } catch {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "error", message: "Stream error" })}\n\n`
        ));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
