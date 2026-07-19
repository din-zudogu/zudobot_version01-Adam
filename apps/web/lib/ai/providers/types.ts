/**
 * Provider-neutral chat interface.
 *
 * The app builds a ChatGenRequest (prompt + history + the model candidates it
 * wants tried) and hands it to whatever ChatProvider is configured. Swapping
 * Gemini → Vertex Provisioned Throughput → Claude/OpenAI later means writing a
 * new ChatProvider — the widget/RAG/prompt code never changes.
 */

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export type ChatPayloadPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

export interface ChatGenRequest {
  /** Full system prompt (persona, rules, KB, language directive). */
  systemInstruction: string;
  /** Prior conversation turns, oldest → newest. */
  history: ChatTurn[];
  /** The current user message — plain string, or parts when files are attached. */
  message: string | ChatPayloadPart[];
  /** Models to try in order (primary first, then fallbacks). */
  modelCandidates: string[];
  temperature: number;
  /** Enable the provider's web-search/grounding tool, if it has one. */
  enableSearch: boolean;
  /** Per-request timeout override (ms). Falls back to the provider default. */
  timeoutMs?: number;
}

export interface ChatGenResult {
  /** The generated reply text (may be empty — caller decides the fallback). */
  reply: string;
  /** Which candidate actually produced the reply (for logging/analytics). */
  modelUsed: string;
}

export interface ChatProvider {
  readonly name: string;
  /**
   * Generate a reply. Handles its own retry / model fallback internally and
   * THROWS the underlying error when every candidate fails, so the caller can
   * map it to a user-facing message via parseGeminiError().
   */
  generateChat(req: ChatGenRequest): Promise<ChatGenResult>;
}
