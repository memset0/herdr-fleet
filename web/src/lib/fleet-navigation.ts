// HERDR FLEET'S DOCUMENT NAVIGATION, for the service worker (FORK.toml authenticated-navigation-cache).
//
// Every navigation asks the network first, so the Gateway — not a copy an earlier session left behind
// — decides whether this request still owns a live session. Whatever the network answers is what the
// browser gets: a document, the Gateway's `401`, a redirect to login, an error page. Nothing here is
// stored.
//
// Only when the request itself fails — no network, no route to the Gateway — does a navigation outside
// the network-only paths get the precached app shell. The shell is the build's own `index.html`,
// fetched when the worker installed, and holds nothing protected; it is what lets Collie's offline
// reading (1.18) open on a cold start. The network-only paths (the API, the sign-in namespace) never
// fall back, so a failed sign-in navigation fails rather than showing an app it cannot authorise.

/** The precached shell, or undefined when this worker holds none. */
export type ShellLookup = () => Promise<Response | undefined>;

export function networkFirstNavigation(
  fetcher: (request: Request) => Promise<Response>,
  shell: ShellLookup,
  networkOnly: (pathAndSearch: string) => boolean,
): (options: { request: Request; url: URL }) => Promise<Response> {
  return async ({ request, url }) => {
    try {
      return await fetcher(request);
    } catch (error) {
      if (networkOnly(`${url.pathname}${url.search}`)) throw error;
      const cached = await shell();
      if (cached === undefined) throw error;
      return cached;
    }
  };
}
