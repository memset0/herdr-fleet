import { html } from "./html.ts";

export interface FleetSettingsMarkupOptions {
  cacheOptions: string;
  cacheSize: number;
  pluginVersion: string;
  shortcutRows: string;
}

export function fleetSettingsMarkup(
  options: FleetSettingsMarkupOptions,
): string {
  return html`<footer id="host-rail-footer" class="host-rail-footer">
    <span
      class="host-rail-version"
      aria-label="Web Remote version ${options.pluginVersion}"
      >v${options.pluginVersion}</span
    >
    <div class="fleet-settings-anchor">
      <button
        id="fleet-settings-toggle"
        class="host-rail-settings"
        type="button"
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-controls="fleet-settings"
        aria-label="Fleet settings"
        title="Fleet settings"
      >
        <svg
          class="header-icon"
          data-icon="settings"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
          ></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
      <section
        id="fleet-settings"
        class="fleet-settings"
        role="dialog"
        aria-label="Fleet settings"
        hidden
      >
        <div class="fleet-settings-heading">
          <strong>Fleet settings</strong><span>Browser only</span>
        </div>
        <label class="fleet-setting-row" for="iframe-cache-size">
          <span
            ><strong>Cached pages</strong
            ><small>Keep recently visited Hosts alive</small></span
          >
          <select
            id="iframe-cache-size"
            aria-describedby="iframe-cache-default"
          >
            ${options.cacheOptions}
          </select>
        </label>
        <div class="fleet-settings-foot">
          <span id="iframe-cache-default">Default: ${options.cacheSize}</span>
          <button id="iframe-cache-reset" type="button">Use default</button>
        </div>
        <section
          class="fleet-shortcuts"
          aria-labelledby="fleet-shortcuts-heading"
        >
          <h2 id="fleet-shortcuts-heading">Shortcuts</h2>
          <ul>
            ${options.shortcutRows}
          </ul>
        </section>
      </section>
    </div>
  </footer>`;
}
