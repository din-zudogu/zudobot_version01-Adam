export interface ExtensionInstallState {
  oauthReady: boolean;
  domainVerified: boolean;
  cmsAdminVerified: boolean;
}

export interface Path2WorkflowPayload {
  hostname: string;
  cmsAdminVerified?: boolean;
  platformId?: "wordpress" | "unknown";
}
