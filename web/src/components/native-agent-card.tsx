import { PaneTagButton, PaneTagLine } from "@/components/fleet-pane-tags";
import { Star } from "lucide-react";

import { operatorChosenName } from "../../../fleet/ui/pane-naming.ts";
import { AgentIcon } from "@/components/agent-icon";
import { PaneMeta } from "@/components/pane-meta";
import { StatusDot } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shortCwd, timeAgoShort } from "@/lib/format";
import { t } from "@/lib/i18n";
import { isUnseen } from "@/lib/triage";
import { statusLabel, type AgentView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";

interface NativeAgentCardProps {
  agent: AgentView;
  onOpen: () => void;
  /** Whether this device pinned the pane — Collie's own pin, which the star toggles. */
  pinned: boolean;
  onPinToggle: () => void;
  /**
   * The ordinal a keyboard shortcut will reach this row by. Omitted past the range a shortcut can
   * address, where a number names nothing the operator can type; the slot stays, so names align.
   */
  index?: number;
  /** Which timestamp the row dates itself by, or none — the same rule the herd list uses. */
  age?: "seen" | "active";
  /**
   * "card" for the one section Collie draws in its alert accent (a person is wanted NOW), "row" for
   * everything else. Read by the rail from Collie's own section record, never restated here.
   */
  density?: "card" | "row";
  /** The row stands for the Pane the route is showing. */
  current?: boolean;
  /** The row's identity, so the rail can put focus back on this row's star after a pin moved it. */
  rowKey?: string;
}

/** The highest row a single keypress can address. Past it the badge would promise a shortcut. */
export const NATIVE_AGENT_SHORTCUT_LIMIT = 9;

/**
 * THE RAIL'S ROW: Collie's row, with the fork's order of the two lines.
 *
 * The fork's compact type and roomier two-line content reserve one trailing action column.
 * The smaller desktop targets stack pin above tags; coarse pointers get independent 44px targets.
 * Host/session metadata remains native, while cache readings are omitted from this glance view.
 *
 * WHAT IS THE FORK'S IS THE ORDER. Collie's dashboard row leads with the pane's own title and puts
 * the address beneath it, which is right for a full-width list read as the page. This rail is chrome
 * beside the work, read at a glance, and there the lines answer the other way round: WHERE first —
 * the Space, then the name the operator gave this piece of work — and WHAT it is doing second. The
 * shortcut ordinal leads, because a key addresses a row on screen, not a heading.
 *
 * THE NAME ON LINE 1 is the same rule the hierarchy uses (fleet/ui/pane-naming.ts): the operator's
 * own name for the pane when they gave it one, and the Tab's otherwise — never a number the
 * multiplexer assigned, and never a terminal title, which line 2 already carries.
 *
 * WHY NOT REUSE THE SHARED CARD. It serves the dashboard, the space view and the pane sheet through
 * four presentation props; a fifth that reverses its two lines stops being a variant. Collie's own
 * rows keep their behaviour exactly, and this one is ours.
 */
export function NativeAgentCard({
  agent,
  onOpen,
  pinned,
  onPinToggle,
  index,
  age,
  density = "row",
  current = false,
  rowKey,
}: NativeAgentCardProps) {
  useLocale();
  const flat = density === "row";
  const blocked = agent.status === "blocked";
  const unseen = isUnseen(agent);
  // The shared surface encloses body and passive tags; controls remain independent siblings.
  const Shell = flat ? "div" : Card;
  const project = agent.workspaceLabel || agent.workspaceId;
  const name = operatorChosenName(agent.paneLabel) ?? agent.tabLabel ?? agent.agent;
  const doing = secondaryLine(agent, name);
  const stamp = age === "seen" ? agent.lastSeenAt : age === "active" ? agent.lastActiveAt : undefined;
  const badge =
    index !== undefined && index < NATIVE_AGENT_SHORTCUT_LIMIT ? String(index + 1) : null;

  return (
    <div data-slot="native-agent-card" data-row-key={rowKey} className="relative min-w-0">
      <Shell
        data-agent-surface=""
        className={cn(
          "flex min-w-0 flex-col gap-0 py-0 transition-colors",
          !flat && "rounded-xl shadow-sm",
          !current && "hover:bg-muted/50",
          // State paint surrounds both body and tags; a blocked card also keeps its alarm edge.
          blocked && (flat ? "bg-status-blocked/10" : "border-status-blocked/40 bg-status-blocked/5"),
          current && "bg-accent text-accent-foreground",
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          aria-current={current ? "page" : undefined}
          className="w-full text-left transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        >
          <div data-slot="native-agent-body" className="flex min-h-16 min-w-0 flex-row items-center gap-3 px-3 py-2 pr-10 2xl:pointer-coarse:min-h-24 2xl:pointer-coarse:pr-14 max-sm:pr-26 max-2xl:pointer-coarse:pr-26">
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              {/* Line 1 — where, then which. */}
              <span data-slot="native-agent-row-title" className="flex min-w-0 items-center gap-1.5 text-xs leading-4">
                <span
                  aria-hidden
                  className="w-3 shrink-0 text-center text-xs leading-none tabular-nums text-muted-foreground"
                >
                  {badge}
                </span>
                <StatusDot
                  status={agent.status}
                  // A hollow resting ring is filled with the ground it actually sits on.
                  surface={current ? "bg-accent" : flat ? "bg-chrome" : "bg-card"}
                  glide="dot"
                />
                <AgentIcon agent={agent.agent} className="size-3.5" glide="tile" />
                {/* Space and work name form one phrase: only its trailing end gives up width. */}
                <span data-slot="native-agent-heading" className="min-w-0 flex-1 truncate self-baseline">
                  <span className="text-muted-foreground">{project}</span>
                  <span className="text-muted-foreground">{" · "}</span>
                  <span data-glide="name" className="font-medium text-foreground">
                    {name}
                  </span>
                </span>
              </span>
              {/* Line 2 — what, with the age at its end. Collie's 16px slot, always drawn. */}
              <span
                data-slot="native-agent-row-detail"
                className="flex min-h-4 min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                {/* WHICH MACHINE, in Collie's own pane meta (host · session, borderless) — the
                    run Collie's dashboard row ends its first line with. Here it LEADS line 2: a 320px
                    rail cannot give line 1 to a name and a host tag both, and the name is the one
                    fact that tells two rows apart. It draws nothing on a solo snapshot. */}
                <PaneMeta
                  host={agent.host}
                  cache={undefined}
                  session={agent.session}
                  className="max-sm:min-w-0 max-sm:shrink max-sm:[&>*]:min-w-0 max-sm:[&>*]:shrink max-sm:[&>span:empty]:hidden max-2xl:pointer-coarse:min-w-0 max-2xl:pointer-coarse:shrink max-2xl:pointer-coarse:[&>*]:min-w-0 max-2xl:pointer-coarse:[&>*]:shrink max-2xl:pointer-coarse:[&>span:empty]:hidden"
                />
                <span className="min-w-0 flex-1 truncate">{doing ?? ""}</span>
                {stamp !== undefined && <span className="shrink-0 tabular-nums">{timeAgoShort(stamp)}</span>}
              </span>
            </span>
          </div>
          {/* The dot is colour only; its word is for a screen reader, after the row's own text. */}
          <span className="sr-only">{statusLabel(agent.status)}</span>
          {unseen && <span className="sr-only">{t("home.row.unseen")}</span>}
        </button>

        <PaneTagLine agent={agent} />
      </Shell>

      {/* Sibling actions never invoke the row's open button. */}
      <div data-slot="native-agent-actions" className="absolute right-1 top-1 flex flex-col max-sm:top-2 max-sm:flex-row max-sm:gap-1 max-2xl:pointer-coarse:top-2 max-2xl:pointer-coarse:flex-row max-2xl:pointer-coarse:gap-1">
        <Button
          data-slot="agent-pin"
          variant="ghost"
          size="icon"
          type="button"
          aria-pressed={pinned}
          aria-label={pinned ? t("home.favorite.remove", { name }) : t("home.favorite.add", { name })}
          onClick={onPinToggle}
          className={cn(
            "size-7 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 pointer-coarse:size-11 max-sm:size-11",
            pinned && "text-foreground",
          )}
        >
          <Star className={cn("size-3.5", pinned && "fill-current")} aria-hidden />
        </Button>
        <PaneTagButton agent={agent} />
      </div>
    </div>
  );
}

/**
 * What the pane is doing, or nothing.
 *
 * The session name first — a coding agent's own title for the work, which is the sentence a reader
 * wants — then the terminal's title while the program that wrote it is still running, then the
 * directory when it says something the line above does not. Never a repeat of line 1's name.
 */
function secondaryLine(agent: AgentView, name: string): string | null {
  const stale = agent.terminalTitle !== undefined && agent.terminalTitleStale === true;
  const own = agent.sessionName || (stale ? "" : agent.terminalTitle);
  const line = own || (agent.cwd ? shortCwd(agent.cwd) : "");
  if (line === "" || line === name) return null;
  return line;
}
