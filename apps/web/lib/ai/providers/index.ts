/**
 * Chat-provider registry. The active provider is chosen by the AI_PROVIDER env
 * var (default "gemini"). Adding Vertex Provisioned Throughput, Claude, OpenAI,
 * etc. later = drop in a new ChatProvider and a case here — no app changes.
 */
import { geminiProvider } from "./geminiProvider";
import type { ChatProvider } from "./types";

export * from "./types";

let warned = false;

export function getChatProvider(): ChatProvider {
  const name = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  switch (name) {
    case "gemini":
      return geminiProvider;
    // Future:
    //   case "vertex": return vertexProvider;   // Provisioned Throughput
    //   case "claude": return claudeProvider;    // multi-provider failover
    default:
      if (!warned) {
        warned = true;
        console.warn(`[AI] unknown AI_PROVIDER="${name}" — falling back to gemini`);
      }
      return geminiProvider;
  }
}
