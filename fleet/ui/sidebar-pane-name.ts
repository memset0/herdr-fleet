import { operatorChosenName } from "./pane-naming.ts";

interface SidebarPane {
  readonly paneLabel?: string;
  readonly sessionName?: string;
  readonly terminalTitle?: string;
  readonly terminalTitleStale?: boolean;
  readonly agent: string;
  readonly cwd: string;
}

const clean = (value: string) => value.replace(/^[^\p{L}\p{N}]+/u, "").trim();
const pathTitle = (value: string) => /^[~/]|^[A-Za-z]:\\/.test(value.trim());

/** Sidebar presentation only: no tab-name promotion or mutation of stored terminal identity. */
export function sidebarPaneName(pane: SidebarPane): string {
  const program = pane.agent;
  const candidates = [operatorChosenName(pane.paneLabel), pane.sessionName,
    pane.terminalTitleStale ? undefined : pane.terminalTitle];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parts = program.toLowerCase() === "codex" ? candidate.split(/\s+\|\s+/) : [candidate];
    for (const part of parts) {
      if (pathTitle(part.replace(/^[^\p{L}\p{N}~/]+/u, ""))) continue;
      const name = clean(part);
      if (!name || /^\d+$/.test(name) || name.includes("@") || name.toLowerCase() === program.toLowerCase()
        || /^action required$/i.test(name)) continue;
      return name;
    }
  }
  const folder = pane.cwd.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || (pane.cwd ? "/" : "");
  return [program, folder].filter(Boolean).join(" · ");
}
