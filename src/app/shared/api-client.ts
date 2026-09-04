/** Minimal fetch wrapper for the plain (non-Angular-service) data stores — `fetch()` already sends
 *  the session cookie automatically for same-origin requests, so there's nothing else to configure.
 *  Used instead of HttpClient here since these are free functions, not injectable services. */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as { error?: string } | null)?.error ?? `Request to ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}
