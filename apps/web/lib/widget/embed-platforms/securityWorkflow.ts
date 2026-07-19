import { WidgetEmbedOptions, SecurityWorkflowStatus } from './types';
import { verifyPath1ManualSecurity } from './path1Security';

/**
 * PATH 1 dashboard status. OAuth/CMS steps are always false here —
 * see Path 2 (Chrome extension) module.
 */
export function verifySecurityWorkflow(
  options: WidgetEmbedOptions
): SecurityWorkflowStatus {
  const path1 = verifyPath1ManualSecurity(options);

  return {
    oauthReady: false,
    domainMatched: path1.domainMatched,
    adminVerified: false,
    sriEnabled: path1.sriEnabled,
    isReadyForAutoInstall: path1.readyToInstall,
  };
}

export { verifyPath1ManualSecurity } from './path1Security';
