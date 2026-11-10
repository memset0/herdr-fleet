import { expect, test } from "bun:test";
import { sidebarPaneName } from "./sidebar-pane-name.ts";
const pane = { agent: "codex", cwd: "/example/project" };
test("pane and session names win without a tab-name fallback", () => {
  expect(sidebarPaneName({ ...pane, paneLabel: "✨ Work", sessionName: "Other" })).toBe("Work");
  expect(sidebarPaneName({ ...pane, paneLabel: "1", sessionName: "Session" })).toBe("Session");
});
test("Codex strips decorations, directory suffixes and action-required fragments", () => {
  expect(sidebarPaneName({ ...pane, terminalTitle: "✦ Action Required | Implement sidebar | /example/project" })).toBe("Implement sidebar");
});
test("paths, prompts, generic and stale titles fall back to program and folder", () => {
  for (const terminalTitle of ["/example/project", "~/project", "✨ /example/project", "C:\\example\\project", "user@host:~/project", "codex", "Action Required", "1", ""]) {
    expect(sidebarPaneName({ ...pane, terminalTitle })).toBe("codex · project");
  }
  expect(sidebarPaneName({ ...pane, terminalTitle: "Old work", terminalTitleStale: true })).toBe("codex · project");
});
