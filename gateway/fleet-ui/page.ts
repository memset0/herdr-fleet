import {
  FLEET_COMMANDS,
  parseFleetShortcutDocument,
  publicFleetShortcutDocument,
  type FleetShortcutConfiguration,
} from "../../shared/fleet/index.ts";
import { html } from "./markup/html.ts";
import { fleetShellMarkup } from "./markup/shell.ts";

function cacheOptions(): string {
  return Array.from({ length: 10 }, (_, index) => {
    const size = index + 1;
    return `<option value="${size}">${size}</option>`;
  }).join("");
}

function shortcutRows(shortcuts: FleetShortcutConfiguration): string {
  return FLEET_COMMANDS.map((command) => {
    const bindings = shortcuts.bindingsByCommand[command.id] ?? [];
    const bindingMarkup = bindings.length
      ? bindings
          .map((binding) => {
            const chord = binding.chord;
            const label =
              binding.kind === "prefix"
                ? `${shortcuts.prefix.label} ${chord.label}`
                : chord.label;
            return html`<kbd
              data-binding-kind="${binding.kind}"
              data-binding-code="${chord.code}"
              data-binding-alt="${Number(chord.altKey)}"
              data-binding-ctrl="${Number(chord.ctrlKey)}"
              data-binding-meta="${Number(chord.metaKey)}"
              data-binding-shift="${Number(chord.shiftKey)}"
              data-binding-label="${chord.label}"
              >${label}</kbd
            >`;
          })
          .join("")
      : '<span class="fleet-shortcut-unbound">Unbound</span>';
    return html`<li
      data-command-id="${command.id}"
      data-command-name="${command.name}"
      data-command-scope="${command.scope}"
    >
      <span>${command.name}</span
      ><span class="fleet-shortcut-bindings">${bindingMarkup}</span>
    </li>`;
  }).join("");
}

export function fleetPage(
  iframeCacheSize = 1,
  pluginVersion = "development",
  shortcuts: FleetShortcutConfiguration = parseFleetShortcutDocument(
    publicFleetShortcutDocument(),
    { requireComplete: true },
  ),
): string {
  const boundedCacheSize =
    Number.isSafeInteger(iframeCacheSize) &&
    iframeCacheSize >= 1 &&
    iframeCacheSize <= 10
      ? iframeCacheSize
      : 1;
  const safeVersion = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(pluginVersion)
    ? pluginVersion
    : "unknown";
  return fleetShellMarkup({
    cacheOptions: cacheOptions(),
    cacheSize: boundedCacheSize,
    pluginVersion: safeVersion,
    shortcutRows: shortcutRows(shortcuts),
    shortcutPrefix: shortcuts.prefix,
  });
}
