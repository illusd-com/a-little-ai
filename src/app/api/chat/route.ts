import { NextRequest } from "next/server";
import { ensureUser, addMessage, getMessages } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, message, password } = body;

    if (!username || !message) {
      return new Response(JSON.stringify({ error: "username and message required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await ensureUser(username);

    // Save user message
    await addMessage(username, "user", message);

    // Load history
    const history = await getMessages(username, 40);
    const messages = history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      ...(m.reasoning ? { reasoning_content: m.reasoning } : {}),
    }));

    // Add system if first
    if (messages.length <= 1) {
      messages.unshift({
        role: "system",
        content:
          "You are a helpful, concise AI assistant on a little ai platform. Respond in the language the user uses. Be clear and useful.",
      });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "NVIDIA_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const nvidiaRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: "stepfun-ai/step-5-preview",
        messages,
        stream: true,
        max_tokens: 4096,
        reasoning_effort: user.reasoning_effort || "medium",
      }),
    });

    if (!nvidiaRes.ok) {
      const errText = await nvidiaRes.text();
      console.error("NVIDIA error", nvidiaRes.status, errText);
      return new Response(JSON.stringify({ error: "AI provider error", detail: errText }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream and collect for DB
    const encoder = new TextEncoder();
    let fullContent = "";
    let fullReasoning = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = nvidiaRes.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;
                try {
                  const json = JSON.parse(data);
                  const delta = json.choices?.[0]?.delta;
                  if (delta?.content) {
                    fullContent += delta.content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta.content })}\n\n`));
                  }
                  if (delta?.reasoning_content) {
                    fullReasoning += delta.reasoning_content;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ reasoning: delta.reasoning_content })}\n\n`)
                    );
                  }
                } catch {
                  // skip
                }
              }
            }
          }

          // Save assistant message
          if (fullContent || fullReasoning) {
            await addMessage(username, "assistant", fullContent || "(no content)", fullReasoning || null);
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (err) {
          console.error(err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "stream error" })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message || "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
