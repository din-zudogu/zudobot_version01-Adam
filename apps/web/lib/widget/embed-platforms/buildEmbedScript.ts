import { WidgetEmbedOptions } from './types';

export function buildEmbedScript(options: WidgetEmbedOptions): string {
  const { tenantId, embedKey, appUrl } = options;

  if (!tenantId || !embedKey || !appUrl) {
    throw new Error('Critical Error: Missing required widget parameters.');
  }

  const cleanAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
  const path =
    options.scriptPath?.trim().startsWith('/')
      ? options.scriptPath.trim()
      : '/widget.js';
  const scriptUrl = `${cleanAppUrl}${path}`;

  const isTenantWidget = path === '/widget.js';

  return `<script
  src="${scriptUrl}"
  data-tenant-id="${tenantId}"
  data-embed-key="${embedKey}"${isTenantWidget ? `\n  data-key="${embedKey}"` : ''}
  data-api-url="${cleanAppUrl}"
  defer
></script>`;
}
