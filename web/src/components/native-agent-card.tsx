import { PaneTagButton, PaneTagLine } from "@/components/fleet-pane-tags";
import { Star } from "lucide-react";

import { operatorChosenName } from "../../../fleet/ui/pane-naming.ts";
import { AgentIcon } from "@/components/agent-icon";
import { PaneMeta } from "@/components/pane-meta";
import { StatusDot } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { UnseenMark } from "@/components/ui/unseen-mark";
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
 * EVERYTHING ABOUT THE BOX IS COLLIE'S `agent-row`: 44px stated rather than grown (`h-11 py-0`), the
 * status dot leading inline, the 16px agent mark, a 16px medium name, Collie's unseen square after
 * it, a 12px muted line 2 led by Collie's own pane meta (host · cache · session, borderless), the 36px round star in a shared `pr-20` control reserve, and the same `data-glide` part names. A rail row
 * and a dashboard row stand for one object; a reader should not have to learn two sizes for it.
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
  // Collie's own switch, for Collie's own reason: a card is a bordered object with air around it, a
  // flat row is a line inside one bordered group, and the two cannot be one element with a class.
  const Shell = flat ? "div" : Card;
  const project = agent.workspaceLabel || agent.workspaceId;
  const name = operatorChosenName(agent.paneLabel) ?? agent.tabLabel ?? agent.agent;
  const doing = secondaryLine(agent, name);
  const stamp = age === "seen" ? agent.lastSeenAt : age === "active" ? agent.lastActiveAt : undefined;
  const badge =
    index !== undefined && index < NATIVE_AGENT_SHORTCUT_LIMIT ? String(index + 1) : null;

  return (
    <div data-slot="native-agent-card" data-row-key={rowKey} className="relative min-w-0">
      <button
        type="button"
        onClick={onOpen}
        aria-current={current ? "page" : undefined}
        className={cn(
          "w-full text-left transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
          // A flat row has no box of its own to light up, so the hover lives out here on the row.
          flat && "transition-colors",
          flat && !current && "hover:bg-muted/50",
        )}
      >
        <Shell
          className={cn(
            // THE HEIGHT IS THE STATEMENT, exactly as on Collie's row: 44px whether line 2 has
            // anything to say or not, so nothing in the rail moves when a pane's title arrives.
            "flex h-11 min-w-0 flex-row items-center gap-3 px-3.5 py-0 pr-20",
            !flat && "rounded-xl shadow-sm transition-colors",
            !flat && !current && "hover:bg-muted/50",
            // The blocked tint survives both, because it is the one cue that reads at a glance; a
            // card keeps its alarm edge as well, and a flat row takes nothing on its edge.
            blocked && (flat ? "bg-status-blocked/10" : "border-status-blocked/40 bg-status-blocked/5"),
            // The pane on screen, in Collie's switcher idiom. Applied after the tint, because two
            // grounds cannot both win; a blocked card keeps its edge, so both cues compose.
            current && "bg-accent text-accent-foreground",
          )}
        >
          <span className="min-w-0 flex-1">
            {/* Line 1 — where, then which. */}
            <span data-slot="native-agent-row-title" className="flex min-w-0 items-center gap-2">
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
              <AgentIcon agent={agent.agent} className="size-4" glide="tile" />
              {/* The Space gives up width first: it is the run every sibling row repeats, and the
                  name beside it is the only thing telling two rows apart. */}
              <span className="flex min-w-0 items-baseline gap-1 self-baseline">
                <span className="min-w-0 max-w-[45%] shrink truncate text-muted-foreground">{project}</span>
                <span className="shrink-0 text-muted-foreground">·</span>
                <span data-glide="name" className="min-w-0 truncate font-medium text-foreground">
                  {name}
                </span>
              </span>
              <UnseenMark on={unseen} reserve />
            </span>
            {/* Line 2 — what, with the age at its end. Collie's 16px slot, always drawn. */}
            <span
              data-slot="native-agent-row-detail"
              className="flex h-4 min-w-0 items-center gap-2 text-xs text-muted-foreground"
            >
              {/* WHICH MACHINE, in Collie's own pane meta (host · cache · session, borderless) — the
                  run Collie's dashboard row ends its first line with. Here it LEADS line 2: a 320px
                  rail cannot give line 1 to a 16px name and a host tag both, and the name is the one
                  fact that tells two rows apart. It draws nothing on a solo snapshot. */}
              <PaneMeta host={agent.host} cache={agent.cache} session={agent.session} />
              <span className="min-w-0 flex-1 truncate">{doing ?? ""}</span>
              {stamp !== undefined && <span className="shrink-0 tabular-nums">{timeAgoShort(stamp)}</span>}
            </span>
          </span>
        </Shell>
        {/* The dot is colour only; its word is for a screen reader, after the row's own text. */}
        <span className="sr-only">{statusLabel(agent.status)}</span>
      </button>

      <PaneTagLine agent={agent} />
      <PaneTagButton agent={agent} />

      {/* A sibling and never a child: a button inside a button is invalid markup, and nesting would
          make starring a row also open it. Collie's round icon button, the one its own dashboard row
          wears through the favourites port: 36px, a 16px glyph, muted ink at full strength rather
          than at half (half failed 3:1 on the chrome ground). ALWAYS DRAWN — a control that appears
          on hover is a control a phone does not have. */}
      <button
        type="button"
        aria-pressed={pinned}
        aria-label={pinned ? t("home.favorite.remove", { name }) : t("home.favorite.add", { name })}
        onClick={onPinToggle}
        className={cn(
          "absolute right-1.5 top-1 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95",
          pinned && "text-foreground",
        )}
      >
        <Star className={cn("size-4", pinned && "fill-current")} aria-hidden />
      </button>
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
