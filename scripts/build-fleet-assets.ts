import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { GATEWAY_THEME_CSS } from "../gateway/theme.ts";

const root = join(import.meta.dir, "..");
const source = join(root, "gateway/fleet-ui/fleet.ts");
const target = join(root, "gateway/fleet-ui/dist");
const staging = join(root, "gateway/fleet-ui/dist-staging");
const previous = join(root, "gateway/fleet-ui/dist-old");

let activeBuild: Promise<void> | null = null;

export function buildFleetAssets(): Promise<void> {
  activeBuild ??= performFleetAssetBuild().finally(() => {
    activeBuild = null;
  });
  return activeBuild;
}

async function performFleetAssetBuild(): Promise<void> {
  await rm(staging, { recursive: true, force: true });
  await rm(previous, { recursive: true, force: true });
}

if (import.meta.main) await buildFleetAssets();
await mkdir(staging, { recursive: true });

const result = await Bun.build({
  entrypoints: [source],
  outdir: staging,
  naming: "fleet.[ext]",
  target: "browser",
  format: "esm",
  minify: true,
  sourcemap: "none",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error("Fleet asset build failed");
}

const files = (await readdir(staging)).sort();
if (files.length !== 2 || files[0] !== "fleet.css" || files[1] !== "fleet.js") {
  throw new Error(
    `Fleet asset build emitted an unexpected file set: ${files.join(", ")}`,
  );
}
const cssPath = join(staging, "fleet.css");
const css = await readFile(cssPath, "utf8");
await writeFile(cssPath, `${GATEWAY_THEME_CSS}\n${css}`);
for (const name of files) {
  const value = await readFile(join(staging, name));
  if (value.byteLength === 0) throw new Error(`Fleet asset ${name} is empty`);
}

try {
  await rename(target, previous);
} catch (error) {
  if (
    !(error instanceof Error) ||
    !("code" in error) ||
    error.code !== "ENOENT"
  )
    throw error;
}
try {
  await rename(staging, target);
} catch (error) {
  try {
    await rename(previous, target);
  } catch {
    // The original error is the actionable one; an absent prior build has nothing to restore.
  }
  throw error;
}
await rm(previous, { recursive: true, force: true });
