/**
 * After a new deploy, a copy of the app that was already open (or installed) still asks for the old
 * version's script files, which no longer exist — the page then fails to load. When that happens,
 * reload once so the browser picks up the new version. A sessionStorage flag stops it looping if
 * the reload doesn't help; it's cleared again once a page loads fine.
 */
const FLAG = 'redline-stale-reload';

const STALE_CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|ChunkLoadError|MIME type/i;

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return STALE_CHUNK.test(message);
}

/** Reloads the page once for a stale-chunk error; returns whether it did. */
export function reloadOnceForStaleChunk(error: unknown): boolean {
  if (!isStaleChunkError(error)) return false;
  try {
    if (sessionStorage.getItem(FLAG)) return false;
    sessionStorage.setItem(FLAG, '1');
  } catch {
    // No storage (private mode): still reload, the browser's own cache-busting usually fixes it
  }
  location.reload();
  return true;
}

/** Call once a page has loaded successfully, so a later deploy can reload again. */
export function clearStaleChunkFlag() {
  try {
    sessionStorage.removeItem(FLAG);
  } catch {
    // ignore
  }
}

export function installStaleChunkReload() {
  window.addEventListener('unhandledrejection', (e) => {
    if (reloadOnceForStaleChunk(e.reason)) e.preventDefault();
  });
}
