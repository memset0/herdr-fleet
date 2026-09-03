const FLEET_ASSET_NAMES = new Set(["fleet.css", "fleet.js"]);

export type FleetAssetName = "fleet.css" | "fleet.js";

export function fleetAssetFile(
  name: FleetAssetName,
): ReturnType<typeof Bun.file> {
  if (!FLEET_ASSET_NAMES.has(name)) throw new Error("unsupported Fleet asset");
  return Bun.file(new URL(`./dist/${name}`, import.meta.url));
}

export async function fleetAssetResponse(
  name: FleetAssetName,
): Promise<Response> {
  const file = fleetAssetFile(name);
  if (!(await file.exists())) {
    return new Response("Fleet assets are not built\n", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  return new Response(file, {
    headers: {
      "content-type": name.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "text/javascript; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
