async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try { r = await fetch(API_BASE + path, { ...init, headers: { "Content-Type": "application/json", ...(await authHeaders()) } }); }
  catch { throw new Error(API_DOWN); }
  // A reply that is not JSON did not come from our API (a static host or the dev server answered instead).
  if (!(r.headers.get("content-type") ?? "").includes("application/json")) {
    throw new Error(`${API_DOWN} (${r.status} came from ${API_BASE || location.origin}, not from the API)`);
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body as T;
}