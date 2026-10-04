import { describe, expect, test } from "bun:test";

const PAGE = await Bun.file(new URL("../../../web/src/components/agent-chat.tsx", import.meta.url)).text();

describe("Send Alt+Up Pane port", () => {
  test("registers one constant chord through the existing guarded writer", () => {
    expect(PAGE).toContain('"send-alt-up": () => sendFixedKeys(["alt+Up"])');
    const writer = PAGE.slice(PAGE.indexOf("async function sendFixedKeys("), PAGE.indexOf("// DOWNSTREAM PORT — the Pane-scoped commands"));
    expect(writer).toContain("if (readOnly || hostBlock !== undefined) return;");
    expect(writer.match(/await sendKeys\(paneId, keys, scope\)/g)).toHaveLength(1);
    expect(writer).not.toContain('"Enter"');
  });
});
