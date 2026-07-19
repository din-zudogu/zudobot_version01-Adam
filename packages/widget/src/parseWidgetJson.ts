/** Reject HTML/SPA fallbacks masquerading as API responses (OWASP: no opaque errors to client). */
export async function parseWidgetJsonResponse<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
