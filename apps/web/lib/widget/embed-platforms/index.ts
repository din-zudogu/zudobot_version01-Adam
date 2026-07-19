import { WidgetEmbedOptions, WidgetEmbedResult } from './types';
import { detectPlatformFromUrl } from './detectPlatform';
import { platformRegistry } from './registry';
import { buildEmbedScript } from './buildEmbedScript';
import { verifySecurityWorkflow } from './securityWorkflow';

/**
 * Main orchestrator for generating the Embed Assistant details.
 * Strictly adheres to security protocols and automated parameter hydration.
 */
export function buildWidgetEmbedAssistant(options: WidgetEmbedOptions): WidgetEmbedResult {
  // 1. Platform Detection
  const detectedPlatform = detectPlatformFromUrl(options.targetUrl);

  // 2. Load the correct, precise manual guide
  const manualGuide = platformRegistry[detectedPlatform] || platformRegistry['Unknown'];

  // 3. Generate Secure Script (Will throw Error if SRI or parameters are missing)
  const embedScript = buildEmbedScript(options);

  // 4. Verify the 4-step Security Workflow (Preparation for Phase 2 Extensions)
  const securityWorkflowStatus = verifySecurityWorkflow(options);

  return {
    embedScript,
    detectedPlatform,
    manualGuide,
    securityWorkflowStatus
  };
}

export type MultiSiteEmbedEntry = {
  domain: string;
  targetUrl: string;
  result: WidgetEmbedResult;
};

/**
 * Admin: หลายโดเมนใน Whitelist — สคริปต์สากลชุดเดียว + คู่มือ/security แยกต่อเว็บ
 */
export function buildWidgetEmbedAssistantsForDomains(
  base: Omit<WidgetEmbedOptions, 'allowedDomain' | 'targetUrl'>,
  domains: string[],
): { universalEmbedScript: string; sites: MultiSiteEmbedEntry[] } {
  const cleaned = domains
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error('Critical Error: At least one allowed domain is required.');
  }

  const sites: MultiSiteEmbedEntry[] = cleaned.map((domain) => {
    const targetUrl = `https://${domain}`;
    return {
      domain,
      targetUrl,
      result: buildWidgetEmbedAssistant({
        ...base,
        allowedDomain: domain,
        targetUrl,
      }),
    };
  });

  return {
    universalEmbedScript: sites[0].result.embedScript,
    sites,
  };
}

export { buildEmbedScript } from './buildEmbedScript';
export { detectPlatformFromUrl } from './detectPlatform';
export { platformRegistry } from './registry';
export { verifyPath1ManualSecurity } from './path1Security';
export type { Path1SecurityStatus } from './path1Security';
export * from './types';
