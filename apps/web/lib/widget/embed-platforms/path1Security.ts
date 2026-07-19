import { WidgetEmbedOptions } from './types';

/** PATH 1 only — SRI + whitelist domain. No OAuth/CMS (those belong to Path 2/3). */
export interface Path1SecurityStatus {
  domainMatched: boolean;
  sriEnabled: boolean;
  readyToInstall: boolean;
}

export function verifyPath1ManualSecurity(
  options: WidgetEmbedOptions
): Path1SecurityStatus {
  let domainMatched = false;
  if (options.targetUrl && options.allowedDomain) {
    try {
      const parsedTarget = new URL(
        options.targetUrl.startsWith('http')
          ? options.targetUrl
          : `https://${options.targetUrl}`
      );
      const parsedAllowed = new URL(
        options.allowedDomain.startsWith('http')
          ? options.allowedDomain
          : `https://${options.allowedDomain}`
      );
      domainMatched =
        parsedTarget.hostname.toLowerCase() ===
        parsedAllowed.hostname.toLowerCase();
    } catch {
      domainMatched = false;
    }
  }

  return {
    domainMatched,
    sriEnabled: true,
    readyToInstall: domainMatched,
  };
}
