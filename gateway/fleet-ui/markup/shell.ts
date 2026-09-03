import { fleetDialogsMarkup } from "./dialogs.ts";
import { documentShell } from "./document.ts";
import { html } from "./html.ts";
import { fleetSettingsMarkup } from "./settings.ts";

export interface FleetShellMarkupOptions {
  cacheOptions: string;
  cacheSize: number;
  pluginVersion: string;
  shortcutRows: string;
  shortcutPrefix: {
    code: string;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    label: string;
  };
}

export function fleetShellMarkup(options: FleetShellMarkupOptions): string {
  const prefix = options.shortcutPrefix;
  const settings = fleetSettingsMarkup(options);
  return documentShell(
    "Fleet · Collie",
    html`<main
      class="fleet-shell"
      data-iframe-cache-size="${options.cacheSize}"
      data-plugin-version="${options.pluginVersion}"
      data-shortcut-prefix-code="${prefix.code}"
      data-shortcut-prefix-alt="${Number(prefix.altKey)}"
      data-shortcut-prefix-ctrl="${Number(prefix.ctrlKey)}"
      data-shortcut-prefix-meta="${Number(prefix.metaKey)}"
      data-shortcut-prefix-shift="${Number(prefix.shiftKey)}"
      data-shortcut-prefix-label="${prefix.label}"
    >
      <header id="host-rail" class="fleet-header">
        <button
          id="tree-menu-toggle"
          class="fleet-mark fleet-tree-toggle"
          type="button"
          aria-expanded="false"
          aria-controls="instances"
          aria-label="Open Host tree"
          title="Hosts"
        >
          H
        </button>
        <a
          class="fleet-mark fleet-home-mark"
          href="/"
          aria-label="Fleet home"
          title="Herdr Fleet"
          >H</a
        >
        <nav
          id="host-switcher"
          class="host-switcher"
          aria-label="Herdr Host switcher"
          role="tablist"
        >
          <span class="connecting">Connecting…</span>
        </nav>
        <nav
          id="instances"
          class="instance-strip"
          aria-label="Herdr Hosts"
          role="tree"
          aria-hidden="true"
          inert
        >
          <span class="connecting">Connecting…</span>
        </nav>
        <button
          id="agent-menu-toggle"
          class="header-action agent-menu-toggle"
          type="button"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-controls="agent-menu"
          aria-label="Open all Agents"
          title="All Agents"
        >
          <svg
            class="header-icon agent-menu-icon"
            data-icon="agent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="16" height="12" x="4" y="8" rx="2"></rect>
            <path d="M12 8V4H8"></path>
            <path d="M2 14h2"></path>
            <path d="M20 14h2"></path>
            <path d="M9 13v2"></path>
            <path d="M15 13v2"></path>
          </svg>
          <span
            id="agent-menu-count"
            class="agent-menu-count"
            aria-hidden="true"
            >0</span
          >
        </button>
        <a
          id="open-node"
          class="header-action"
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open selected Collie in a new tab"
          title="Open in new tab"
          hidden
        >
          <svg
            class="header-icon"
            data-icon="external-link"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M15 3h6v6"></path>
            <path d="M10 14 21 3"></path>
            <path
              d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
            ></path>
          </svg>
        </a>
        <div
          id="tree-action-status"
          class="tree-action-status"
          role="status"
          hidden
        ></div>
        ${settings}
      </header>
      <button
        id="tree-menu-backdrop"
        class="tree-menu-backdrop"
        type="button"
        aria-label="Close Host tree"
        hidden
      ></button>
      <aside
        id="agent-menu"
        class="agent-menu"
        aria-label="Agents across all Hosts"
        hidden
      >
        <div class="agent-menu-heading">
          <div>
            <p class="agent-menu-eyebrow">FLEET</p>
            <h1>All Agents</h1>
          </div>
          <span
            id="agent-refresh-state"
            class="agent-refresh-state"
            role="status"
            >Refreshing…</span
          >
        </div>
        <div id="agent-sections" class="agent-sections"></div>
      </aside>
      <div
        id="host-rail-resizer"
        class="rail-resizer host-rail-resizer"
        role="separator"
        aria-label="Resize Host sidebar"
        aria-orientation="vertical"
        aria-controls="host-rail"
        tabindex="0"
      ></div>
      <div
        id="agent-rail-resizer"
        class="rail-resizer agent-rail-resizer"
        role="separator"
        aria-label="Resize Agent sidebar"
        aria-orientation="vertical"
        aria-controls="agent-menu"
        tabindex="0"
      ></div>
      <section id="frame-stage" class="frame-stage" aria-live="polite">
        <div id="frame-loading" class="frame-loading" hidden>
          <span class="loading-mark" aria-hidden="true">H</span
          ><span>Opening Collie…</span>
        </div>
        <aside id="node-notice" class="node-notice" role="status" hidden>
          <span id="notice-dot" class="status-dot"></span
          ><span id="notice-text" class="notice-text"></span
          ><button id="retry-frame" class="notice-action" type="button">
            Retry
          </button>
        </aside>
        <div id="empty-state" class="empty-state" hidden>
          <span class="empty-mark" aria-hidden="true">H</span>
          <h1 id="empty-title">No instances</h1>
          <p id="empty-copy">No enabled Herdr instances are configured.</p>
          <button id="retry-inventory" class="primary-action" type="button">
            Try again
          </button>
        </div>
      </section>
      ${fleetDialogsMarkup()}
    </main>`,
    ["/fleet-assets/fleet.css", "/fleet-assets/fleet.js"],
  );
}
