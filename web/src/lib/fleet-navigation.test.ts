import { networkFirstNavigation } from "./fleet-navigation";

const SHELL = new Response("<!doctype html><title>shell</title>");
const nav = (path: string) => {
  const url = new URL(path, "https://fleet.example.com");
  return { request: new Request(url, { mode: "same-origin" }), url };
};
const networkOnly = (path: string) => /^\/(api|auth)(\/|$)/u.test(path);

describe("Fleet's document navigation", () => {
  it("returns whatever the network answers, a refusal included, and never consults the shell", async () => {
    const shell = vi.fn(async () => SHELL.clone());
    for (const answer of [
      new Response("doc", { status: 200 }),
      new Response('{"error":"authentication required"}', { status: 401 }),
      new Response(null, { status: 303, headers: { location: "/auth/login?next=%2F" } }),
      new Response("upstream unavailable", { status: 502 }),
    ]) {
      const handle = networkFirstNavigation(async () => answer, shell, networkOnly);
      expect(await handle(nav("/pane/w1:p1"))).toBe(answer);
    }
    expect(shell).not.toHaveBeenCalled();
  });

  it("opens the precached shell only when the request itself fails", async () => {
    const handle = networkFirstNavigation(async () => Promise.reject(new TypeError("offline")), async () => SHELL.clone(), networkOnly);
    expect(await (await handle(nav("/pane/w1:p1"))).text()).toContain("shell");
  });

  it("lets a failed network-only navigation fail, as it does with no shell at all", async () => {
    const failing = async () => Promise.reject(new TypeError("offline"));
    await expect(networkFirstNavigation(failing, async () => SHELL.clone(), networkOnly)(nav("/auth/login"))).rejects.toThrow("offline");
    await expect(networkFirstNavigation(failing, async () => undefined, networkOnly)(nav("/"))).rejects.toThrow("offline");
  });
});
