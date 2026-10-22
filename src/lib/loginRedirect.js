// The round trip through the login page: where to come back to, and only ever
// to this site.

/** A `?redirect=` target kept only if it stays on this origin; else "/".
 *  Parsed as the browser would: "/\\evil.com", "/<tab>/evil.com" or
 *  "//evil.com" all name another host and are refused. */
export function internalRedirect(target) {
  if (!target || typeof window === "undefined") return "/";
  try {
    const url = new URL(target, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

/** The login page, bringing the user back to this page (query included). */
export function loginHref() {
  const here = window.location.pathname + window.location.search;
  return here === "/" ? "/login" : `/login?redirect=${encodeURIComponent(here)}`;
}
