const PLATFORM_HEADER = "x-zudobot-platform-knowledge";

/** Tenant knowledge API fetch; set platform=true for Zudogu admin site KB. */
export function kbFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  platform = false,
): Promise<Response> {
  if (!platform) return fetch(input, init);

  const headers = new Headers(init?.headers);
  headers.set(PLATFORM_HEADER, "1");
  return fetch(input, { ...init, headers });
}
