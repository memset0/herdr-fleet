import type { FleetClientContext } from "./context.ts";

export function installDialogs(ctx: FleetClientContext): void {
  ctx.services.trapDialogFocus = function (event, root) {
    if (event.key !== "Tab") return false;
    const focusable = Array.from(
      (root as ParentNode).querySelectorAll<HTMLElement>(
        'input,button:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ).filter((item) => !item.hidden && item.offsetParent !== null);
    if (!focusable.length) return false;
    const index = focusable.indexOf(
      ctx.runtime.document.activeElement as HTMLElement,
    );
    const next = event.shiftKey
      ? index <= 0
        ? focusable.length - 1
        : index - 1
      : index < 0 || index === focusable.length - 1
        ? 0
        : index + 1;
    event.preventDefault();
    focusable[next]?.focus();
    return true;
  };
  ctx.services.movePaletteSelection = function (key) {
    const state = ctx.state.commandDialogState;
    if (state?.mode !== "palette") return;
    const enabled = state.commands
      .map((command: any, index: number) =>
        ctx.services.commandAvailable(command.id) ? index : -1,
      )
      .filter((index: number) => index >= 0);
    if (!enabled.length) return;
    const position = enabled.indexOf(state.selectedIndex);
    if (key === "Home") state.selectedIndex = enabled[0];
    else if (key === "End") state.selectedIndex = enabled[enabled.length - 1];
    else
      state.selectedIndex =
        enabled[
          (Math.max(0, position) +
            (key === "ArrowDown" ? 1 : -1) +
            enabled.length) %
            enabled.length
        ];
    ctx.services.renderCommandPalette();
    const selected = ctx.elements.commandDialogResults.querySelector(
      '[aria-selected="true"]',
    );
    if (selected) selected.scrollIntoView({ block: "nearest" });
  };
}
