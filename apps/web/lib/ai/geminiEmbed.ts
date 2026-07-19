import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireGeminiApiKey } from "@/lib/env/amplifyGuardrail";

/** Canonical Google embedding model (768-dim, v1beta). */
export const DEFAULT_GEMINI_EMBED_MODEL = "text-embedding-004";

/** Fail-fast: abort hung Gemini embed calls (ms). */
export const GEMINI_EMBED_REQUEST_TIMEOUT_MS = 5_000;

const EMBED_API_VERSIONS = ["v1beta", "v1"] as const;

export function resolveEmbedModelName(): string {
  const fromEnv = process.env.GEMINI_EMBED_MODEL?.trim();
  return fromEnv || DEFAULT_GEMINI_EMBED_MODEL;
}

export function buildEmbedModelCandidates(preferred?: string): string[] {
  return Array.from(
    new Set(
      [
        preferred?.trim(),
        process.env.GEMINI_EMBED_MODEL?.trim(),
        DEFAULT_GEMINI_EMBED_MODEL,
        "gemini-embedding-001",
      ].filter((v): v is string => Boolean(v)),
    ),
  );
}

export function isModelNotFoundError(err: unknown): boolean {
  if (err == null) return false;
  const message =
    err instanceof Error
      ? err.message.toLowerCase()
      : String((err as { message?: unknown }).message ?? err).toLowerCase();
  const status =
    err instanceof Error
      ? (err as Error & { status?: number }).status
      : (err as { status?: number }).status;
  return (
    status === 404 ||
    message.includes("not found") ||
    message.includes("not_found") ||
    message.includes("is not found")
  );
}

export async function embedText(text: string, preferredModel?: string): Promise<number[]> {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return [];

  const candidates = buildEmbedModelCandidates(preferredModel);
  const genAI = new GoogleGenerativeAI(requireGeminiApiKey());
  let lastError: unknown = null;

  outer:
  for (const modelName of candidates) {
    for (const apiVersion of EMBED_API_VERSIONS) {
      try {
        const geminiModel = genAI.getGenerativeModel(
          { model: modelName },
          { apiVersion, timeout: GEMINI_EMBED_REQUEST_TIMEOUT_MS },
        );
        const result = await geminiModel.embedContent(trimmed.slice(0, 2_048));
        const values = result.embedding?.values;
        if (values?.length) return values;
        throw new Error(`empty_embedding from model ${modelName} (${apiVersion})`);
      } catch (error: unknown) {
        lastError = error;
        if (!isModelNotFoundError(error)) break outer;
      }
    }
  }

  throw lastError ?? new Error("Failed all embedding model candidates");
}
