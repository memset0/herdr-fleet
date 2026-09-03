import { Star } from "lucide-react";

import { operatorChosenName } from "../../../fleet/ui/pane-naming.ts";
import { AgentIcon } from "@/components/agent-icon";
import { StatusDot } from "@/components/status-badge";
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
}: NativeAgentCardProps) {
  useLocale();
  const project = agent.workspaceLabel || agent.workspaceId;
  const name = operatorChosenName(agent.paneLabel) ?? agent.tabLabel ?? agent.agent;
  const doing = secondaryLine(agent, name);
  const stamp = age === "seen" ? agent.lastSeenAt : age === "active" ? agent.lastActiveAt : undefined;
  const badge =
    index !== undefined && index < NATIVE_AGENT_SHORTCUT_LIMIT ? String(index + 1) : null;

  return (
    <div
      data-slot="native-agent-card"
      className="group flex min-w-0 items-center gap-1 rounded-md pr-1 hover:bg-muted"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        {/* The avatar carries both marks the row needs and neither costs a column: the state at the
            corner the eye already lands on, and the shortcut ordinal at the one it does not. */}
        {/* NO BOX BEHIND THE MARK. `AgentIcon` draws its own tile — a brand gradient, or a bordered
            initials chip — so a wrapper with a ground of its own put a second, differently-coloured
            square behind it and made both badges read as blobs sitting on that square rather than on
            the row. The badges carry no ring for the same reason: the row is their ground. */}
        <span className="relative shrink-0">
          <AgentIcon agent={agent.agent} className="size-8" />
          <StatusDot
            status={agent.status}
            surface="bg-chrome"
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
          <span className="flex min-w-0 items-baseline gap-1 overflow-hidden text-[13px] leading-tight">
            <span className="min-w-0 truncate text-muted-foreground">{project}</span>
            <span className="shrink-0 text-muted-foreground">·</span>
            {/* Both truncate. The name was `shrink-0`, which let a long Tab name push the row past
                its container — on a phone the whole sheet then read as shifted left. */}
            <span className="min-w-0 truncate text-foreground">{name}</span>
            {stamp !== undefined && (
              <span className="ml-auto shrink-0 pl-1 text-[11px] tabular-nums text-muted-foreground">
                {timeAgoShort(stamp)}
              </span>
            )}
          </span>
          {/* Line 2 — what. Absent rather than padded: a row with nothing to say here is one line
              tall, which is the honest height for it. */}
          {doing !== null && (
            <span className="min-w-0 truncate text-[11px] leading-tight text-muted-foreground">
              {doing}
            </span>
          )}
        </span>
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
          "grid size-7 shrink-0 place-items-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
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
