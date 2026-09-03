import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

describe("Fleet client source boundary", () => {
  test("keeps explicit cross-origin and rendering prohibitions", async () => {
    const directory = import.meta.dir;
    const sources = await Promise.all(
      (await readdir(directory))
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => Bun.file(join(directory, name)).text()),
    );
    const source = sources.join("\n");
    expect(source).not.toContain("innerHTML");
    expect(source).not.toContain("contentWindow.document");
    expect(source).not.toContain("contentWindow.location");
    expect(source).not.toContain("window.prompt");
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("contentWindow.fetch");
  });
});
