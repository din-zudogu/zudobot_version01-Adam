export type SupportedPlatform = 'WordPress' | 'Shopify' | 'Wix' | 'Squarespace' | 'Webflow' | 'Custom' | 'Unknown';

export interface WidgetEmbedOptions {
  tenantId: string;
  embedKey: string;
  allowedDomain: string; // The strictly whitelisted domain
  targetUrl?: string; // Optional URL to detect platform
  appUrl: string; // The base URL of our Zudobot application (e.g., https://zudobot.zudogu.com)
  scriptIntegrity?: string; // Optional — SRI removed (first-party server, no CDN)
  /** Default /widget.js — Admin global embed uses /api/public/zudobot/widget.js */
  scriptPath?: string;
}

export interface PlatformInstruction {
  platform: SupportedPlatform;
  displayName: string;
  installationType: 'App' | 'Plugin' | 'Manual';
  steps: string[];
}

export interface SecurityWorkflowStatus {
  oauthReady: boolean;
  domainMatched: boolean;
  adminVerified: boolean;
  sriEnabled: boolean;
  isReadyForAutoInstall: boolean;
}

export interface WidgetEmbedResult {
  embedScript: string; // Fully hydrated <script> tag ready to copy-paste
  detectedPlatform: SupportedPlatform;
  manualGuide: PlatformInstruction;
  securityWorkflowStatus: SecurityWorkflowStatus;
}
