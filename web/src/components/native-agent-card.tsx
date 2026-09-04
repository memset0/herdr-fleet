import { Star } from "lucide-react";

import { operatorChosenName } from "../../../fleet/ui/pane-naming.ts";
import { AgentIcon } from "@/components/agent-icon";
import { HostChip } from "@/components/host-chip";
import { StatusDot } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { shortCwd, timeAgoShort } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel, type AgentView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/hooks/use-locale";

interface NativeAgentCardProps {
  agent: AgentView;
  onOpen: () => void;
  favorite: boolean;
  onFavoriteToggle: () => void;
  /**
   * The ordinal a keyboard shortcut will reach this row by, badged on the avatar. Omitted past the
   * range a shortcut can address, where a number names nothing the operator can type.
   */
  index?: number;
  /** Which timestamp the row dates itself by, or none — the same rule the herd list uses. */
  age?: "seen" | "active";
  /**
   * Collie's own emphasis, unchanged and read from Collie's own set (`components/agent-list.tsx`'s
   * `ATTENTION`): "card" for the sections that mean a person is wanted here, "row" for the rest.
   *
   * The dashboard's argument applies verbatim in a 320px rail, and the rail proved it: card chrome
   * on every row is wallpaper rather than emphasis — a Working row and a Recent row drawn
   * identically throw away the four-level priority `triage()` had just computed. See a card,
   * something wants you; all flat, nothing does.
   */
  density?: "card" | "row";
}

/** The highest row a single keypress can address. Past it the badge would promise a shortcut. */
export const NATIVE_AGENT_SHORTCUT_LIMIT = 9;

/**
 * THE RAIL'S ROW, and it is the fork's own rather than Collie's card.
 *
 * Collie's dashboard row leads with the pane's own title and puts the address beneath it, which is
 * right for a full-width list a reader is scanning as the page. This rail is 320px of chrome beside
 * the work, read at a glance while something else has the reader's attention, and there the two
 * lines answer in the other order: WHERE first — the project, then the name the operator gave this
 * piece of work — and WHAT it is doing second. The avatar already says which agent, so neither line
 * spends a word on it.
 *
 * WHY NOT REUSE THE SHARED CARD. It is one component serving the dashboard, the space view and the
 * pane sheet through four presentation props, and this would be a fifth that changes the order of
 * its two lines. That is the point at which a prop stops being a variant and becomes a different
 * component wearing one; Collie's own rows keep their behavior exactly, and this one is ours.
 *
 * THE NAME ON LINE 1 is the same rule the hierarchy uses (fleet/ui/pane-naming.ts): the operator's
 * own name for the pane when they gave it one, and the Tab's otherwise — never a number the
 * multiplexer assigned, and never a terminal title, which line 2 already carries.
 */
export function NativeAgentCard({
  agent,
  onOpen,
  favorite,
  onFavoriteToggle,
  index,
  age,
  density = "card",
}: NativeAgentCardProps) {
  useLocale();
  const flat = density === "row";
  const blocked = agent.status === "blocked";
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
    <div data-slot="native-agent-card" className="group relative min-w-0">
      {/* COLLIE'S OWN TREATMENT, BOTH OF THEM, and deliberately not a third. The rail's rows are the
          same objects the dashboard lists, so they wear the same edge, ground, shadow and press —
          and, just as importantly, they DROP them in the same sections. What the fork owns is the
          ORDER of the two lines inside the box, never the box. */}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "w-full text-left transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
          // A flat row has no box of its own to light up, so the hover lives out here on the row.
          flat && "transition-colors hover:bg-muted/50",
        )}
      >
        <Shell
          className={cn(
            "flex min-w-0 items-center gap-3",
            // NO RADIUS ON A FLAT ROW, in any state: these sit in a `ListGroup`'s run of hairlines,
            // and a rounded fill under a full-width straight line reads as a rendering fault. The
            // 2px left rail is reserved transparent, so a blocked row changes colour without
            // changing the box.
            flat
              ? "flex-row px-3.5 py-2.5 shadow-[inset_2px_0_0_0_transparent]"
              : "flex-row rounded-xl px-3.5 py-3 shadow-sm transition-colors hover:bg-muted/50",
            // The blocked tint survives both, because it is the one cue that reads at a glance.
            blocked &&
              (flat
                ? "bg-status-blocked/5 shadow-[inset_2px_0_0_0_var(--color-status-blocked)]"
                : "border-status-blocked/40 bg-status-blocked/5"),
          )}
        >
          {/* The avatar carries both marks the row needs and neither costs a column: the state at
              the corner the eye already lands on, and the shortcut ordinal at the one it does not.
              NO BOX BEHIND IT: `AgentIcon` draws its own tile, so a wrapper with a ground of its own
              would put a second, differently-coloured square behind the artwork and make both badges
              read as blobs sitting on that square rather than on the row. */}
          <span className="relative shrink-0">
            <AgentIcon agent={agent.agent} className="size-8" />
            <StatusDot
              status={agent.status}
              // A hollow resting ring is filled with the colour it actually sits on — a card is
              // `--card`, and a flat row is the rail it sits on, because `ListGroup` draws a frame
              // and no fill.
              surface={flat ? "bg-chrome" : "bg-card"}
              className="absolute -bottom-0.5 -right-0.5 size-2.5"
            />
            <span className="sr-only">{statusLabel(agent.status)}</span>
            {badge !== null && (
              <span
                aria-hidden
                className="absolute -bottom-1.5 -left-1 text-[9px] font-medium leading-none tabular-nums text-muted-foreground"
              >
                {badge}
              </span>
            )}
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            {/* Line 1 — where. The project gives up width first: it is the run every sibling row
                repeats, and the name beside it is the only thing telling two rows apart. */}
            {/* THE RESERVE FOR THE STAR IS ON THIS LINE, not on the button. The favourite control is
                positioned at the row's top trailing corner, so only the line it shares has to clear
                it — put on the button, the same 32px pushed line 2 in as well and the age stopped
                being at the bottom trailing corner it is supposed to occupy. */}
            <span className="flex min-w-0 items-baseline gap-1 overflow-hidden pr-6 text-[13px] leading-tight">
              <span className="min-w-0 truncate text-muted-foreground">{project}</span>
              <span className="shrink-0 text-muted-foreground">·</span>
              {/* Both truncate. The name was `shrink-0`, which let a long Tab name push the row past
                  its container — on a phone the whole sheet then read as shifted left. */}
              <span className="min-w-0 truncate text-foreground">{name}</span>
            </span>
            {/* Line 2 — what. Absent rather than padded: a row with nothing to say here is one line
                tall, which is the honest height for it. */}
            {/* Line 2 — what, with the age at its trailing end so the row's right edge reads top to
                bottom: the control first, then the fact. */}
            {/* WHICH MACHINE, in Collie's own chip rather than a second vocabulary for one fact. It
                hides itself on a solo snapshot (components/host-chip.tsx), so a single-host rail is
                unchanged; `caption` is its borderless form, which belongs in a line of chrome type
                rather than a pill dropped into it. */}
            {(doing !== null || stamp !== undefined || agent.host !== undefined) && (
              <span className="flex min-w-0 items-baseline gap-2 text-[11px] leading-tight text-muted-foreground">
                <HostChip host={agent.host} variant="caption" className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{doing ?? ""}</span>
                {stamp !== undefined && (
                  <span className="shrink-0 tabular-nums">{timeAgoShort(stamp)}</span>
                )}
              </span>
            )}
          </span>
        </Shell>
      </button>

      {/* A sibling and never a child: a button inside a button is invalid markup, and nesting would
          make favouriting a row also open it. ALWAYS DRAWN, muted until it is set — a control that
          appears on hover is a control a phone does not have. */}
      <button
        type="button"
        aria-pressed={favorite}
        aria-label={
          favorite ? t("home.favorite.remove", { name }) : t("home.favorite.add", { name })
        }
        onClick={onFavoriteToggle}
        className={cn(
          "absolute right-2 grid size-7 place-items-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
          // The corner it sits in is the box's, and the flat row's box is 4px shorter.
          flat ? "top-1.5" : "top-2",
          favorite ? "text-foreground" : "text-muted-foreground/50 hover:text-foreground",
        )}
      >
        <Star className={cn("size-3.5", favorite && "fill-current")} aria-hidden />
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
