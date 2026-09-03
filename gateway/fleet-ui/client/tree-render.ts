import type { FleetClientContext } from "./context.ts";

export function installTreeRender(ctx: FleetClientContext): void {
  ctx.services.renderTree = function (focusKey = null) {
    ctx.services.closeTreeContextMenu();
    ctx.elements.instances.replaceChildren();
    const liveKeys = new Set();
    const nextPaneShortcutTargets = [];
    const route =
      ctx.services.activeEntry()?.route || ctx.services.requestedRoute();
    if (
      route?.view === "pane" &&
      route.spaceId &&
      route.tabId &&
      route.paneId &&
      ctx.state.selectedId
    ) {
      const hostKey = ctx.services.treeKey(
        ctx.state.selectedId,
        route.session || "",
        "host",
        ctx.state.selectedId,
      );
      const spaceKey = ctx.services.treeKey(
        ctx.state.selectedId,
        route.session || "",
        "space",
        route.spaceId,
      );
      const tabKey = ctx.services.treeKey(
        ctx.state.selectedId,
        route.session || "",
        "tab",
        route.tabId,
      );
      ctx.state.expandedTreeKeys.add(hostKey);
      ctx.state.expandedTreeKeys.add(spaceKey);
      ctx.state.expandedTreeKeys.add(tabKey);
    }
    for (const node of ctx.state.nodes) {
      const hostKey = ctx.services.treeKey(node.id, "", "host", node.id);
      liveKeys.add(hostKey);
      if (!ctx.state.initializedHostKeys.has(hostKey)) {
        ctx.state.initializedHostKeys.add(hostKey);
        ctx.state.expandedTreeKeys.add(hostKey);
      }
      const wrapper = ctx.services.element("div", "host-tree");
      wrapper.setAttribute("role", "none");
      const trees = Array.isArray(node.treeSessions) ? node.treeSessions : [];
      const primaryTree = trees.find(
        (tree) => tree && tree.primarySession === true,
      );
      const button = ctx.services.element(
        "button",
        "instance-tab tree-row tree-row-level-1",
      );
      button.type = "button";
      button.setAttribute("role", "treeitem");
      button.setAttribute("aria-level", "1");
      button.setAttribute(
        "aria-expanded",
        String(ctx.state.expandedTreeKeys.has(hostKey)),
      );
      button.dataset.instance = node.id;
      button.dataset.treeKey = hostKey;
      button.dataset.health = node.health;
      button.setAttribute(
        "aria-selected",
        String(node.id === ctx.state.selectedId),
      );
      button.setAttribute(
        "aria-label",
        node.name + " · " + ctx.services.healthLabel(node.health),
      );
      const chevron = ctx.services.treeChevron();
      const dot = ctx.services.element("span", "status-dot");
      dot.setAttribute("aria-hidden", "true");
      const label = ctx.services.element(
        "span",
        "instance-name tree-label",
        node.name,
      );
      button.append(chevron, dot, label);
      button.addEventListener("click", (event: MouseEvent) => {
        if (
          (ctx.desktopMedia.matches || ctx.state.treeOpen) &&
          (event.target as Element).closest(".tree-chevron")
        ) {
          ctx.services.toggleTree(hostKey);
          return;
        }
        if (ctx.desktopMedia.matches || ctx.state.treeOpen) {
          ctx.services.selectTreeNode(node.id, {
            route: { view: "home" },
            focusTreeKey: hostKey,
          });
          return;
        }
        ctx.services.selectNode(node.id, { focusTreeKey: hostKey });
      });
      button.addEventListener("keydown", (event: KeyboardEvent) =>
        ctx.services.handleDisclosureKey(event, hostKey),
      );
      const hostRowWrap = ctx.services.element("div", "tree-row-wrap");
      hostRowWrap.setAttribute("role", "none");
      const addSpace = ctx.services.element(
        "button",
        "tree-inline-action",
        "+",
      );
      addSpace.type = "button";
      addSpace.setAttribute("aria-label", "New Space on " + node.name);
      addSpace.title = "New Space";
      addSpace.hidden =
        node.health !== "online" || primaryTree?.reachable !== true;
      addSpace.addEventListener("click", (event: MouseEvent) => {
        event.stopPropagation();
        void ctx.services.createSpaceFromHost(
          node,
          { reachable: primaryTree?.reachable === true },
          addSpace,
        );
      });
      hostRowWrap.append(button, addSpace);
      const { group: hostChildren, inner: hostChildrenInner } =
        ctx.services.treeChildrenGroup(
          hostKey,
          ctx.state.expandedTreeKeys.has(hostKey),
        );
      for (const tree of trees) {
        const session = tree.primarySession
          ? ""
          : ctx.services.validSession(tree.herdrSession);
        if (!tree.primarySession && !session) continue;
        const sessionHint =
          trees.length > 1 && !tree.primarySession ? session : "";
        for (const space of Array.isArray(tree.spaces) ? tree.spaces : []) {
          const spaceId = ctx.services.validPane(space.workspaceId);
          if (!spaceId) continue;
          const spaceKey = ctx.services.treeKey(
            node.id,
            session,
            "space",
            spaceId,
          );
          liveKeys.add(spaceKey);
          const spaceOpen = ctx.state.expandedTreeKeys.has(spaceKey);
          const spaceRow = ctx.services.disclosureRow(
            2,
            spaceKey,
            space.label || "Space " + space.number,
            spaceOpen,
            { stale: !tree.reachable, hint: sessionHint },
          );
          const spaceRowWrap = ctx.services.element("div", "tree-row-wrap");
          spaceRowWrap.setAttribute("role", "none");
          const addPane = ctx.services.element(
            "button",
            "tree-inline-action",
            "+",
          );
          addPane.type = "button";
          addPane.setAttribute(
            "aria-label",
            "New Pane in " + (space.label || "Space " + space.number),
          );
          addPane.title = "New Pane";
          addPane.hidden = !tree.reachable;
          addPane.addEventListener("click", (event: MouseEvent) => {
            event.stopPropagation();
            void ctx.services.createPaneFromSpace(
              node,
              {
                workspaceId: spaceId,
                session: !tree.primarySession && session ? session : "",
                reachable: tree.reachable,
              },
              addPane,
            );
          });
          spaceRowWrap.append(spaceRow, addPane);
          const { group: spaceChildren, inner: spaceChildrenInner } =
            ctx.services.treeChildrenGroup(spaceKey, spaceOpen);
          for (const tab of Array.isArray(space.tabs) ? space.tabs : []) {
            const tabId = ctx.services.validPane(tab.tabId);
            if (!tabId) continue;
            const tabKey = ctx.services.treeKey(node.id, session, "tab", tabId);
            liveKeys.add(tabKey);
            const tabLabel = tab.label || "Tab " + tab.number;
            const validPanes = ctx.services.validTabPanes(tab);
            if (validPanes.length <= 1)
              ctx.state.expandedTreeKeys.delete(tabKey);
            if (validPanes.length === 0) {
              const tabRow = ctx.services.element(
                "button",
                "tree-row tree-row-level-3",
              );
              tabRow.type = "button";
              tabRow.dataset.treeKey = tabKey;
              tabRow.dataset.disabled = "true";
              tabRow.setAttribute("role", "treeitem");
              tabRow.setAttribute("aria-level", "3");
              tabRow.setAttribute("aria-disabled", "true");
              if (!tree.reachable) tabRow.dataset.stale = "true";
              tabRow.append(
                ctx.services.element("span", "tree-label", tabLabel),
              );
              if (tree.reachable)
                ctx.services.bindTreeContextActions(tabRow, {
                  nodeId: node.id,
                  kind: "tab",
                  action: "rename-tab",
                  targetId: tabId,
                  label: tabLabel,
                  paneIds: [],
                  paneCount: 0,
                  session: !tree.primarySession && session ? session : "",
                  reachable: true,
                });
              spaceChildrenInner.append(tabRow);
              continue;
            }
            if (validPanes.length === 1) {
              const { pane, paneId } = validPanes[0];
              const tabRow = ctx.services.element(
                "button",
                "tree-row tree-row-level-3 direct-pane-tree-row",
              );
              tabRow.type = "button";
              tabRow.dataset.treeKey = tabKey;
              nextPaneShortcutTargets.push({
                key: ctx.services.shortcutPaneKey(
                  node.id,
                  paneId,
                  tree.primarySession ? "" : session,
                ),
                nodeId: node.id,
                treeKey: tabKey,
                route: {
                  view: "pane",
                  spaceId,
                  tabId,
                  paneId,
                  ...(!tree.primarySession && session ? { session } : {}),
                },
              });
              tabRow.setAttribute("role", "treeitem");
              tabRow.setAttribute("aria-level", "3");
              if (!tree.reachable) tabRow.dataset.stale = "true";
              const selected =
                node.id === ctx.state.selectedId &&
                route.view === "pane" &&
                route.paneId === paneId &&
                (route.session || "") === (tree.primarySession ? "" : session);
              tabRow.setAttribute("aria-selected", String(selected));
              const paneState = ctx.services.appendPaneTreatment(
                tabRow,
                pane,
                tabLabel,
              );
              tabRow.setAttribute("aria-label", tabLabel + " · " + paneState);
              tabRow.addEventListener("click", () =>
                ctx.services.selectTreeNode(node.id, {
                  route: {
                    view: "pane",
                    spaceId,
                    tabId,
                    paneId,
                    ...(!tree.primarySession && session ? { session } : {}),
                  },
                  focusTreeKey: tabKey,
                }),
              );
              if (tree.reachable)
                ctx.services.bindTreeContextActions(tabRow, {
                  nodeId: node.id,
                  kind: "tab",
                  action: "rename-tab",
                  targetId: tabId,
                  label: tabLabel,
                  paneIds: [paneId],
                  paneCount: 1,
                  session: !tree.primarySession && session ? session : "",
                  reachable: true,
                });
              spaceChildrenInner.append(tabRow);
              continue;
            }
            const tabOpen = ctx.state.expandedTreeKeys.has(tabKey);
            const tabRow = ctx.services.disclosureRow(
              3,
              tabKey,
              tabLabel,
              tabOpen,
              { stale: !tree.reachable },
            );
            if (tree.reachable)
              ctx.services.bindTreeContextActions(tabRow, {
                nodeId: node.id,
                kind: "tab",
                action: "rename-tab",
                targetId: tabId,
                label: tabLabel,
                paneIds: validPanes.map((entry: any) => entry.paneId),
                paneCount: validPanes.length,
                session: !tree.primarySession && session ? session : "",
                reachable: true,
              });
            const { group: tabChildren, inner: tabChildrenInner } =
              ctx.services.treeChildrenGroup(tabKey, tabOpen);
            for (const { pane, paneId } of validPanes) {
              const paneKey = ctx.services.treeKey(
                node.id,
                session,
                "pane",
                paneId,
              );
              liveKeys.add(paneKey);
              nextPaneShortcutTargets.push({
                key: ctx.services.shortcutPaneKey(
                  node.id,
                  paneId,
                  tree.primarySession ? "" : session,
                ),
                nodeId: node.id,
                treeKey: paneKey,
                route: {
                  view: "pane",
                  spaceId,
                  tabId,
                  paneId,
                  ...(!tree.primarySession && session ? { session } : {}),
                },
              });
              const paneRow = ctx.services.element(
                "button",
                "tree-row tree-row-level-4 pane-tree-row",
              );
              paneRow.type = "button";
              paneRow.dataset.treeKey = paneKey;
              paneRow.setAttribute("role", "treeitem");
              paneRow.setAttribute("aria-level", "4");
              if (!tree.reachable) paneRow.dataset.stale = "true";
              const selected =
                node.id === ctx.state.selectedId &&
                route.view === "pane" &&
                route.paneId === paneId &&
                (route.session || "") === (tree.primarySession ? "" : session);
              paneRow.setAttribute("aria-selected", String(selected));
              ctx.services.appendPaneTreatment(
                paneRow,
                pane,
                ctx.services.paneLabel(pane),
              );
              paneRow.addEventListener("click", () =>
                ctx.services.selectTreeNode(node.id, {
                  route: {
                    view: "pane",
                    spaceId,
                    tabId,
                    paneId,
                    ...(!tree.primarySession && session ? { session } : {}),
                  },
                  focusTreeKey: paneKey,
                }),
              );
              if (tree.reachable)
                ctx.services.bindTreeContextActions(paneRow, {
                  nodeId: node.id,
                  kind: "pane",
                  action: "rename-pane",
                  targetId: paneId,
                  tabId,
                  label: pane.label || "",
                  session: !tree.primarySession && session ? session : "",
                  reachable: true,
                });
              tabChildrenInner.append(paneRow);
            }
            spaceChildrenInner.append(tabRow, tabChildren);
          }
          hostChildrenInner.append(spaceRowWrap, spaceChildren);
        }
      }
      wrapper.append(hostRowWrap, hostChildren);
      ctx.elements.instances.append(wrapper);
    }
    ctx.state.paneShortcutTargets = nextPaneShortcutTargets;
    for (const key of [...ctx.state.expandedTreeKeys]) {
      if (!liveKeys.has(key)) ctx.state.expandedTreeKeys.delete(key);
    }
    const active = focusKey
      ? Array.from(
          ctx.elements.instances.querySelectorAll<HTMLElement>(
            "[data-tree-key]",
          ),
        ).find((entry) => entry.dataset.treeKey === focusKey)
      : ctx.elements.instances.querySelector<HTMLElement>(
          '[data-instance][aria-selected="true"]',
        );
    if (active) {
      active.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (focusKey) active.focus();
    }
  };

  ctx.services.renderTabs = function (focusSelected = false) {
    ctx.services.renderTree(
      typeof focusSelected === "string" ? focusSelected : null,
    );
    ctx.services.renderHostSwitcher(focusSelected === true);
  };
}
