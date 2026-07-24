import Anthropic from "@anthropic-ai/sdk";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

let cached: Anthropic | null = null;

/** Lazy-cached Claude client for the git-connect install agent. Separate
 *  from apps/web/lib/ai/providers (Gemini) — this is a genuinely different,
 *  tool-use/agentic workload, not a chat completion. */
export function getGitAgentClient(): Anthropic {
  if (cached) return cached;
  cached = new Anthropic({ apiKey: AMPLIFY_CONFIG.anthropicApiKey });
  return cached;
}
