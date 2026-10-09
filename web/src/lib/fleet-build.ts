/**
 * Whether this bundle was built as Herdr Fleet.
 *
 * The Fleet build states it at build time: `web/package.json`'s `build` script — the one every
 * production bundle goes through, `collie build` (Herdr's build step, the lead's deployment) and
 * `bun run build:web` alike — sets `VITE_HERDR_FLEET=1`, `fleet/build-flag.test.ts` pins it, and Vite
 * inlines the answer into the bundle. Nothing at run time can change it: no cookie, no request, no
 * setting.
 *
 * A bundle built without it is Collie's own layout. That is what upstream's component suites and its
 * browser tier build (`bun run e2e` calls `vite build` itself), so they meet the layout they were written against, and the fork's own suites
 * cover the Fleet layout by stating the build (`vi.stubEnv("VITE_HERDR_FLEET", "1")`). It is read
 * through a function, at render time, so that stub reaches it.
 */
export function isFleetBuild(): boolean {
  return import.meta.env.VITE_HERDR_FLEET === "1";
}
