import type { FleetClientContext } from "./context.ts";
import {
  FLEET_AGENT_FAVORITES_MAX,
  fleetAgentBucket,
  fleetAgentFavoriteCompare,
} from "../model/agents.ts";

export function installAgents(ctx: FleetClientContext): void {
  ctx.services.agentParts = function (agent) {
    const project = agent.workspaceLabel || agent.workspaceId;
    const own = agent.paneLabel || agent.sessionName || "";
    const cwd =
      !agent.cwd ||
      ctx.services.baseName(agent.cwd).toLowerCase() ===
        String(project).trim().toLowerCase()
        ? ""
        : ctx.services.shortCwd(agent.cwd);
    return { project, tab: agent.tabLabel || "", secondary: own || cwd };
  };

  ctx.services.bucket = function (agent) {
    return fleetAgentBucket(agent);
  };

  ctx.services.sortAgentEntries = function (key, entries) {
    const copy = [...entries];
    copy.sort((a, b) => {
      const favoriteOrder = fleetAgentFavoriteCompare(
        ctx.services.agentFavoriteKey(a.node, a.agent) ?? "",
        ctx.services.agentFavoriteKey(b.node, b.agent) ?? "",
        ctx.state.agentFavorites,
      );
      if (favoriteOrder) return favoriteOrder;
      return key === "needs" || key === "ready" || key === "working"
        ? (b.agent.lastActiveAt || 0) - (a.agent.lastActiveAt || 0)
        : (b.agent.lastSeenAt || 0) - (a.agent.lastSeenAt || 0);
    });
    return copy;
  };

  ctx.services.selectAgent = function (node, agent) {
    const resetAttention =
      Boolean(agent.reachable) &&
      (ctx.services.bucket(agent) === "ready" ||
        ctx.services.bucket(agent) === "needs");
    const spaceId = ctx.services.validPane(agent.workspaceId);
    const tabId = ctx.services.validPane(agent.tabId);
    const paneId = ctx.services.validPane(agent.paneId);
    const session = agent.primarySession
      ? null
      : ctx.services.validSession(agent.herdrSession);
    if (!spaceId || !tabId || !paneId || (!agent.primarySession && !session))
      return;
    ctx.services.closeAgentMenu();
    ctx.services.selectNode(node.id, {
      route: {
        view: "pane",
        spaceId,
        tabId,
        paneId,
        ...(session ? { session } : {}),
      },
    });
    if (resetAttention) void ctx.services.refresh({ manual: true });
  };

  ctx.services.agentFavoriteIcon = function () {
    const svg = ctx.runtime.document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    svg.setAttribute("class", "agent-favorite-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.dataset.icon = "star";
    const path = ctx.runtime.document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path.setAttribute(
      "d",
      "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
    );
    svg.append(path);
    return svg;
  };

  ctx.services.toggleAgentFavorite = function (node, agent) {
    const key = ctx.services.agentFavoriteKey(node, agent);
    if (!key) return;
    const removing = ctx.state.agentFavorites.has(key);
    if (removing) ctx.state.agentFavorites.delete(key);
    else {
      if (ctx.state.agentFavorites.size >= FLEET_AGENT_FAVORITES_MAX) {
        const oldest = ctx.state.agentFavorites.values().next().value;
        if (oldest !== undefined) ctx.state.agentFavorites.delete(oldest);
      }
      ctx.state.agentFavorites.add(key);
    }
    ctx.state.pendingFavoriteFocusKey = key;
    ctx.services.persistAgentFavorites();
    ctx.services.renderAgents(key);
    ctx.services.announce(
      (removing ? "Removed favorite " : "Favorited ") +
        (ctx.services.agentParts(agent).project || agent.agent) +
        ".",
    );
  };

  ctx.services.renderAgentCard = function (
    node,
    agent,
    ordinal = null,
    shortcutBinding = null,
  ) {
    const parts = ctx.services.agentParts(agent);
    const favoriteKey = ctx.services.agentFavoriteKey(node, agent);
    if (!favoriteKey) throw new Error("Fleet Agent identity is invalid");
    const isFavorite = ctx.state.agentFavorites.has(favoriteKey);
    const card = ctx.services.element("div", "agent-card");
    card.dataset.live = String(Boolean(agent.reachable));
    card.dataset.status = agent.status;
    card.dataset.favorite = String(isFavorite);
    const cardSession = agent.primarySession ? "" : agent.herdrSession;
    const shortcutLabel = shortcutBinding
      ? " · Shortcut " + shortcutBinding
      : "";
    const main = ctx.services.element("button", "agent-card-main");
    main.type = "button";
    main.dataset.agentNode = node.id;
    main.dataset.agentPane = agent.paneId;
    main.dataset.agentSession = cardSession;
    main.setAttribute(
      "aria-label",
      (agent.reachable ? "" : "Offline · ") +
        node.name +
        " · " +
        parts.project +
        (parts.tab ? " · " + parts.tab : "") +
        " · " +
        ctx.services.statusLabel(agent.status) +
        shortcutLabel,
    );
    const avatar = ctx.services.element(
      "span",
      "agent-avatar",
      ctx.services.initials(agent.agent),
    );
    avatar.dataset.brand = ctx.services.brand(agent.agent);
    avatar.setAttribute("aria-hidden", "true");
    const dot = ctx.services.element("span", "agent-status-dot");
    dot.style.setProperty(
      "--agent-status-color",
      ctx.services.statusColor(agent.status),
    );
    avatar.append(dot);
    if (ordinal) {
      const badge = ctx.services.element(
        "span",
        "agent-ordinal-badge",
        String(ordinal),
      );
      badge.setAttribute("aria-hidden", "true");
      avatar.append(badge);
    }
    const copy = ctx.services.element("span", "agent-card-copy");
    const title = ctx.services.element("span", "agent-title-line");
    title.dataset.hasTab = String(Boolean(parts.tab));
    title.append(ctx.services.element("span", "agent-project", parts.project));
    if (parts.tab) {
      title.append(
        ctx.services.element("span", "agent-separator", "·"),
        ctx.services.element("span", "agent-tab", parts.tab),
      );
    }
    const meta = ctx.services.element("span", "agent-meta-line");
    const secondary = [
      parts.secondary,
      !agent.primarySession ? agent.herdrSession : "",
    ]
      .filter(Boolean)
      .join(" · ");
    meta.append(
      ctx.services.element("span", "agent-secondary", secondary || agent.agent),
    );
    const host = ctx.services.element("span", "host-chip", node.name);
    host.title = node.publicHost;
    meta.append(host);
    if (agent.reachable) {
      const stamp =
        agent.status === "done" ? agent.lastSeenAt : agent.lastActiveAt;
      if (Number.isSafeInteger(stamp))
        meta.append(
          ctx.services.element(
            "span",
            "agent-age",
            ctx.services.timeAgo(stamp),
          ),
        );
    } else {
      meta.append(ctx.services.element("span", "offline-chip", "offline"));
      if (Number.isSafeInteger(agent.observedAt))
        meta.append(
          ctx.services.element(
            "span",
            "agent-age",
            ctx.services.timeAgo(agent.observedAt),
          ),
        );
    }
    const favorite = ctx.services.element("button", "agent-favorite");
    favorite.type = "button";
    favorite.dataset.favoriteKey = favoriteKey;
    favorite.setAttribute("aria-pressed", String(isFavorite));
    favorite.setAttribute(
      "aria-label",
      (isFavorite ? "Remove favorite " : "Favorite ") +
        parts.project +
        (parts.tab ? " · " + parts.tab : ""),
    );
    favorite.title = isFavorite ? "Remove from favorites" : "Add to favorites";
    favorite.append(ctx.services.agentFavoriteIcon());
    favorite.addEventListener("click", () =>
      ctx.services.toggleAgentFavorite(node, agent),
    );
    const tools = ctx.services.element("div", "agent-card-tools");
    tools.append(favorite);
    copy.append(title, meta);
    main.append(avatar, copy);
    main.addEventListener("click", () => ctx.services.selectAgent(node, agent));
    card.append(main, tools);
    return card;
  };

  ctx.services.renderAgents = function (focusFavoriteKey = null) {
    const favoriteFocusKey =
      focusFavoriteKey ||
      (ctx.runtime.document.activeElement as HTMLElement | null)?.dataset
        .favoriteKey ||
      ctx.state.pendingFavoriteFocusKey;
    ctx.elements.agentSections.replaceChildren();
    const nextAgentShortcutTargets = [];
    const entries = [];
    for (const node of ctx.state.nodes) {
      for (const agent of Array.isArray(node.agentEntries)
        ? node.agentEntries
        : [])
        entries.push({ node, agent });
    }
    const live = entries.filter(({ agent }) => agent.reachable).length;
    const offline = entries.length - live;
    const counted = entries.filter(
      ({ agent }) => ctx.services.bucket(agent) !== "recent",
    ).length;
    ctx.elements.agentMenuCount.textContent = String(counted);
    ctx.elements.agentMenuToggle.title =
      "All Agents · " + counted + " outside Recent";
    ctx.elements.agentMenuToggle.setAttribute(
      "aria-label",
      "Open all Agents · " +
        counted +
        " outside Recent · " +
        live +
        " live" +
        (offline ? " · " + offline + " offline" : ""),
    );
    if (!entries.length) {
      ctx.state.agentShortcutTargets = [];
      ctx.elements.agentSections.append(
        ctx.services.element("p", "agent-empty", "No agents running."),
      );
      ctx.services.syncCurrentAgentControl();
      return;
    }
    const sections = [
      {
        key: "needs",
        label: "Needs you",
        color: "var(--status-blocked)",
        attention: true,
      },
      {
        key: "ready",
        label: "Ready · unseen",
        color: "var(--status-done)",
        attention: true,
      },
      { key: "working", label: "Working", color: "var(--status-working)" },
      { key: "recent", label: "Recent", color: "var(--status-idle)" },
    ];
    for (const section of sections) {
      const matching = ctx.services.sortAgentEntries(
        section.key,
        entries.filter(
          ({ agent }) => ctx.services.bucket(agent) === section.key,
        ),
      );
      if (!matching.length) continue;
      const wrapper = ctx.services.element("section", "agent-section");
      wrapper.dataset.section = section.key;
      wrapper.dataset.attention = String(Boolean(section.attention));
      const heading = ctx.services.element("h2", "agent-section-heading");
      heading.dataset.section = section.key;
      heading.style.setProperty("--section-color", section.color);
      heading.append(
        ctx.services.element("span", "section-dot"),
        ctx.services.element("span", "", section.label),
        ctx.services.element("span", "section-count", matching.length),
      );
      const list = ctx.services.element("div", "agent-card-list");
      for (const entry of matching) {
        const position = nextAgentShortcutTargets.length + 1;
        nextAgentShortcutTargets.push(entry);
        const command =
          position <= 9
            ? ctx.commandsById.get("select-agent-" + position)
            : null;
        const labels = command
          ? ctx.services.commandBindingLabels(command)
          : [];
        const ordinal =
          ctx.desktopMedia.matches && position <= 9 && labels.length
            ? position
            : null;
        list.append(
          ctx.services.renderAgentCard(
            entry.node,
            entry.agent,
            ordinal,
            labels.join(" / ") || null,
          ),
        );
      }
      wrapper.append(heading, list);
      ctx.elements.agentSections.append(wrapper);
    }
    ctx.state.agentShortcutTargets = nextAgentShortcutTargets;
    ctx.services.syncCurrentAgentControl();
    if (favoriteFocusKey) {
      const target = Array.from(
        ctx.elements.agentSections.querySelectorAll<HTMLElement>(
          "[data-favorite-key]",
        ),
      ).find((entry) => entry.dataset.favoriteKey === favoriteFocusKey);
      if (target)
        ctx.runtime.requestAnimationFrame(() => {
          if (target.isConnected) target.focus();
          if (ctx.state.pendingFavoriteFocusKey === favoriteFocusKey)
            ctx.state.pendingFavoriteFocusKey = null;
        });
    }
  };
}
