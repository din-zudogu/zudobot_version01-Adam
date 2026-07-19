import { SupportedPlatform } from './types';

/**
 * Basic heuristic detection of platform based on target URL.
 * Securely parses URL to prevent format string attacks or crash.
 */
export function detectPlatformFromUrl(targetUrl?: string): SupportedPlatform {
  if (!targetUrl || targetUrl.trim() === '') return 'Unknown';

  try {
    // Enforce valid URL parsing
    const url = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    const hostname = url.hostname.toLowerCase();

    if (hostname.includes('myshopify.com')) return 'Shopify';
    if (hostname.includes('wixsite.com')) return 'Wix';
    if (hostname.includes('squarespace.com')) return 'Squarespace';
    if (hostname.includes('webflow.io')) return 'Webflow';

    // If it's a valid custom domain without specific SAAS footprints
    return 'Custom';
  } catch {
    // Fallback if URL is totally invalid
    return 'Unknown';
  }
}
