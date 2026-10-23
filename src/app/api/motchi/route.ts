import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { answerFromGuide } from "@/lib/guide";
import { fakeAgents } from "@/lib/agent-fakes";
import { MOTCHI_MODEL, mayAsk, motchiPerson, motchiSystem, streamRedactor } from "@/lib/motchi";

// Motchi's answers (src/components/motchi), streamed as plain text while he writes them. Only for
// someone signed in; he answers from the user guide for their role and nothing else. When his
// model can't answer (no key, no credits, an outage), the guide answers on its own.

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(6000) }))
    .min(1)
    .max(24),
});

const HEADERS = { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" };
const say = (text: string, status = 200) => new Response(text, { status, headers: HEADERS });

export async function POST(request: Request) {
  const viewer = await getViewer();
  const parsed = Body.safeParse(await request.json().catch(() => null));
  // The conversation starts with his greeting; the API's starts with the person's question.
  const messages = parsed.success ? parsed.data.messages.slice(parsed.data.messages.findIndex((m) => m.role === "user")) : [];
  if (!messages.length || messages.at(-1)?.role !== "user" || messages.at(-1)!.content.length > 1000) return say("I didn't catch that. Ask me again?", 400);
  if (!mayAsk(viewer.id)) return say("You've asked me a lot in a short time! Give me a few minutes, then ask again.", 429);

  const fromGuide = () => answerFromGuide(viewer.role, messages.at(-1)!.content);
  if (fakeAgents() || !process.env.ANTHROPIC_API_KEY) return say(fromGuide());

  const client = new Anthropic();
  const stream = client.beta.messages.stream(
    {
      model: MOTCHI_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: motchiSystem(viewer.role), cache_control: { type: "ephemeral" } },
        { type: "text", text: motchiPerson({ name: viewer.fullName, role: viewer.role }) },
      ],
      messages,
    },
    { signal: request.signal },
  );

  const encoder = new TextEncoder();
  const filter = streamRedactor();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      const send = (text: string) => {
        if (!text) return;
        sent = true;
        controller.enqueue(encoder.encode(text));
      };
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") send(filter.push(event.delta.text));
        }
        const final = await stream.finalMessage();
        send(filter.end());
        if (final.stop_reason === "refusal") send("That's not something I can help with. Ask me anything about using Magik OS!");
        if (final.stop_reason === "max_tokens") send("…");
      } catch (err) {
        if (!request.signal.aborted) {
          console.error("Motchi couldn't answer:", err instanceof Error ? err.message : err);
          send(sent ? "\n\nSorry, I lost my train of thought. Ask me again?" : fromGuide());
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(body, { headers: HEADERS });
}
