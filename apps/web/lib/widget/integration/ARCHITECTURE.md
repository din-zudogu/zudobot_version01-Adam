# Zudobot Integration — 2 Paths (isolated)

**Do not mix logic between paths. Do not touch chat engine, knowledge base, or core DB schemas from install modules.**

| Path | Audience | Module location |
|------|----------|-----------------|
| **1 — Manual Script** | Copy/paste embed with SRI | `lib/widget/embed-platforms/` + `PlatformEmbedAssistant.tsx` |
| **2 — Chrome Extension** | No-code inject (MV3 + `chrome.identity`) | `integrations/path2-chrome-extension/` + `ChromeExtensionInstall.tsx` |

Shared runtime: `packages/widget` → `/widget.js` (tenant).

Optional legacy (not a primary path): WordPress plugin in `integrations/path3-marketplace/wordpress-plugin/` for merchants who self-host WP only.

## Path 2 API contracts

- `POST /api/integration/extension/google-session` — Google token → Zudobot bearer + `embedScript`
- `GET /api/integration/extension/embed-snippet` — refresh script (Bearer)
- `POST /api/integration/verify-domain` — whitelist check
- `POST /api/integration/extension/wp-install` — optional WP REST proxy

## Dashboard ↔ Extension

- `externally_connectable`: `https://zudobot.zudogu.com/*`
- Messages: `CHECK_EXTENSION_INSTALLED`, `TRIGGER_OAUTH`
- Env: `NEXT_PUBLIC_CHROME_EXTENSION_ID`

## Removed (dead code)

- Shopify App / Theme App Embed / `shopify.app.toml` / `/api/integration/shopify/*`
