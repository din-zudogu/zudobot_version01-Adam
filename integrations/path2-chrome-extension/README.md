# Path 2 — Zudobot No-Code Injector (Chrome MV3)

## Permissions (minimal)

- `identity`, `activeTab`, `scripting`, `storage`
- `host_permissions`: `zudobot.zudogu.com`, `googleapis.com` only
- `activeTab` grants inject on the tab the user clicked (no broad `*://*/*`)

## Google OAuth

1. Google Cloud → OAuth client → **Chrome Extension** + Extension ID
2. `manifest.json` → `oauth2.client_id`
3. Amplify → `GOOGLE_EXTENSION_OAUTH_CLIENT_ID` (same client ID)

## Dashboard bridge

Set `NEXT_PUBLIC_CHROME_EXTENSION_ID` on Amplify.

```javascript
chrome.runtime.sendMessage(extensionId, { action: "CHECK_EXTENSION_INSTALLED" });
chrome.runtime.sendMessage(extensionId, { action: "TRIGGER_OAUTH" });
```

## Popup inject

1. Sign in (Google) or connect from dashboard
2. Open store tab → Extension icon → **ฝังสคริปต์บนแท็บนี้**
3. Server-built `embedScript` (SRI) — never edit hash in extension

## Extension signing key (Chrome Web Store)

Keys are generated under `keys/` (gitignored):

| File | Purpose |
|------|---------|
| `zudobot-extension-public.pem` | Public key (PEM) for Developer Dashboard |
| `zudobot-extension-private.pem` | **Secret** — keep for every `.zip` upload |
| `extension-id.txt` | Fixed Extension ID when `key` is in manifest |

Set Amplify: `NEXT_PUBLIC_CHROME_EXTENSION_ID` = Extension ID from `extension-id.txt`.

## Load unpacked

1. Set `oauth2.client_id` in `manifest.json`
2. Chrome → Extensions → Load unpacked → this folder
