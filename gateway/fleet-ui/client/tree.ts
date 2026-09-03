import type { FleetClientContext } from "./context.ts";

export function installTree(ctx: FleetClientContext): void {
  ctx.services.chooseNode = function () {
    const candidates = [
      ctx.state.selectedId,
      ctx.services.requested(),
      ctx.services.remembered(),
    ];
    for (const id of candidates) {
      const match = ctx.state.nodes.find((node) => node.id === id);
      if (match) return match;
    }
    return (
      ctx.state.nodes.find((node) => node.health === "online") ||
      ctx.state.nodes[0] ||
      null
    );
  };

  ctx.services.treeKey = (nodeId, session, kind, id) =>
    [nodeId, session, kind, id].join("|");

  ctx.services.focusTreeKey = function (key) {
    const target = Array.from(
      ctx.elements.instances.querySelectorAll<HTMLElement>("[data-tree-key]"),
    ).find((entry) => entry.dataset.treeKey === key);
    if (target) target.focus();
  };

  ctx.services.toggleTree = function (key) {
    const expanded = !ctx.state.expandedTreeKeys.has(key);
    if (expanded) ctx.state.expandedTreeKeys.add(key);
    else ctx.state.expandedTreeKeys.delete(key);
    const row = Array.from(
      ctx.elements.instances.querySelectorAll<HTMLElement>("[data-tree-key]"),
    ).find((entry) => entry.dataset.treeKey === key);
    const group = Array.from(
      ctx.elements.instances.querySelectorAll<HTMLElement>(
        "[data-tree-children]",
      ),
    ).find((entry) => entry.dataset.treeChildren === key);
    if (!row || !group) {
      ctx.services.renderTree(key);
      return;
    }
    row.setAttribute("aria-expanded", String(expanded));
    group.dataset.expanded = String(expanded);
    group.inert = !expanded;
    group.setAttribute("aria-hidden", String(!expanded));
    row.focus();
  };

  ctx.services.handleDisclosureKey = function (event, key) {
    if (
      (!ctx.desktopMedia.matches && !ctx.state.treeOpen) ||
      (event.key !== "ArrowRight" && event.key !== "ArrowLeft")
    )
      return;
    const shouldOpen = event.key === "ArrowRight";
    if (ctx.state.expandedTreeKeys.has(key) === shouldOpen) return;
    event.preventDefault();
    ctx.services.toggleTree(key);
  };

  ctx.services.treeChevron = function () {
    const svg = ctx.runtime.document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    svg.setAttribute("class", "tree-chevron");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.dataset.icon = "chevron-right";
    const path = ctx.runtime.document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path.setAttribute("d", "m9 18 6-6-6-6");
    svg.append(path);
    return svg;
  };

  ctx.services.treeChildrenGroup = function (key, expanded) {
    const group = ctx.services.element("div", "tree-children");
    group.setAttribute("role", "group");
    group.dataset.treeChildren = key;
    group.dataset.expanded = String(expanded);
    group.inert = !expanded;
    group.setAttribute("aria-hidden", String(!expanded));
    const inner = ctx.services.element("div", "tree-children-inner");
    group.append(inner);
    return { group, inner };
  };

  ctx.services.disclosureRow = function (
    level,
    key,
    label,
    expanded,
    options = {},
  ) {
    const button = ctx.services.element(
      "button",
      "tree-row tree-row-level-" + level,
    );
    button.type = "button";
    button.dataset.treeKey = key;
    button.setAttribute("role", "treeitem");
    button.setAttribute("aria-level", String(level));
    button.setAttribute("aria-expanded", String(expanded));
    if (options.stale) button.dataset.stale = "true";
    const chevron = ctx.services.treeChevron();
    const name = ctx.services.element("span", "tree-label", label);
    button.append(chevron, name);
    if (options.hint)
      button.append(ctx.services.element("span", "tree-hint", options.hint));
    button.addEventListener("click", () => ctx.services.toggleTree(key));
    button.addEventListener("keydown", (event: KeyboardEvent) =>
      ctx.services.handleDisclosureKey(event, key),
    );
    return button;
  };

  ctx.services.paneLabel = function (pane) {
    if (pane.label) return pane.label;
    if (pane.kind === "agent" && pane.agent) return pane.agent;
    const suffix = String(pane.paneId).split(":").pop();
    return "Pane " + (suffix || pane.paneId);
  };

  ctx.services.validTabPanes = function (tab) {
    const panes = [];
    const seen = new Set();
    for (const pane of Array.isArray(tab.panes) ? tab.panes : []) {
      const paneId = ctx.services.validPane(pane && pane.paneId);
      if (!paneId || seen.has(paneId)) continue;
      seen.add(paneId);
      panes.push({ pane, paneId });
    }
    return panes;
  };

  ctx.services.appendPaneTreatment = function (row, pane, label) {
    const paneState =
      pane.kind === "shell" ? "shell" : ctx.services.statusLabel(pane.status);
    const paneDot = ctx.services.element("span", "tree-pane-dot");
    paneDot.style.setProperty(
      "--tree-pane-color",
      pane.kind === "shell"
        ? "var(--status-idle)"
        : ctx.services.statusColor(pane.status),
    );
    paneDot.setAttribute("aria-hidden", "true");
    row.append(
      paneDot,
      ctx.services.element("span", "tree-label", label),
      ctx.services.element("span", "tree-hint", paneState),
    );
    return paneState;
  };

  ctx.services.renderHostSwitcher = function (focusSelected = false) {
    ctx.elements.hostSwitcher.replaceChildren();
    for (const node of ctx.state.nodes) {
      const button = ctx.services.element(
        "button",
        "instance-tab host-switcher-tab",
      );
      button.type = "button";
      button.setAttribute("role", "tab");
      button.dataset.instance = node.id;
      button.dataset.health = node.health;
      const selected = node.id === ctx.state.selectedId;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.setAttribute(
        "aria-label",
        node.name + " · " + ctx.services.healthLabel(node.health),
      );
      const dot = ctx.services.element("span", "status-dot");
      dot.setAttribute("aria-hidden", "true");
      button.append(
        dot,
        ctx.services.element("span", "instance-name", node.name),
      );
      button.addEventListener("click", () =>
        ctx.services.selectNode(node.id, { focusTab: true }),
      );
      ctx.elements.hostSwitcher.append(button);
    }
    if (focusSelected) {
      const active = ctx.elements.hostSwitcher.querySelector<HTMLElement>(
        '[data-instance][aria-selected="true"]',
      );
      if (active) {
        active.scrollIntoView({ block: "nearest", inline: "nearest" });
        active.focus();
      }
    }
  };
}
