/**
 * PATH 1 — Manual Script Embed only.
 * Re-exports; do not add Extension or Marketplace logic here.
 */
export {
  buildWidgetEmbedAssistant,
  buildWidgetEmbedAssistantsForDomains,
  buildEmbedScript,
  detectPlatformFromUrl,
  platformRegistry,
  verifyPath1ManualSecurity,
} from "@/lib/widget/embed-platforms";

export type {
  WidgetEmbedOptions,
  WidgetEmbedResult,
  SupportedPlatform,
  SecurityWorkflowStatus,
  MultiSiteEmbedEntry,
} from "@/lib/widget/embed-platforms";

export {
  resolveWidgetScriptIntegrity,
  EMBED_INTEGRITY_PROCESSING_MESSAGE,
} from "@/lib/widget/resolveWidgetScriptIntegrity";
