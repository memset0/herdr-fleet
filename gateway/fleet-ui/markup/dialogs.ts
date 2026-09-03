import { html } from "./html.ts";

export function fleetDialogsMarkup(): string {
  return html`<section
      id="command-dialog"
      class="command-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-dialog-title"
      hidden
    >
      <button
        id="command-dialog-backdrop"
        class="command-dialog-backdrop"
        type="button"
        tabindex="-1"
        aria-label="Close dialog"
      ></button>
      <div class="command-dialog-panel">
        <form id="command-dialog-form" class="command-dialog-form">
          <label id="command-dialog-title" for="command-dialog-input"
            >Command Palette</label
          >
          <input
            id="command-dialog-input"
            type="text"
            maxlength="256"
            autocomplete="off"
            spellcheck="false"
            aria-controls="command-dialog-results"
            aria-autocomplete="list"
          />
          <p id="command-dialog-hint" class="command-dialog-hint">
            Type / to search commands.
          </p>
          <p
            id="command-dialog-error"
            class="command-dialog-error"
            role="status"
            hidden
          ></p>
          <div
            id="command-dialog-results"
            class="command-dialog-results"
            role="listbox"
            aria-label="Fleet commands"
          ></div>
          <div
            id="command-dialog-actions"
            class="command-dialog-actions"
            hidden
          >
            <button id="command-dialog-cancel" type="button">Cancel</button>
            <button id="command-dialog-save" type="submit">Save</button>
          </div>
        </form>
      </div>
    </section>
    <section
      id="space-close-dialog"
      class="command-dialog destructive-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="space-close-title"
      aria-describedby="space-close-impact"
      hidden
    >
      <button
        id="space-close-backdrop"
        class="command-dialog-backdrop"
        type="button"
        tabindex="-1"
        aria-label="Cancel closing Space"
      ></button>
      <div class="command-dialog-panel">
        <h2 id="space-close-title">Close Space?</h2>
        <p id="space-close-impact" class="command-dialog-hint"></p>
        <p
          id="space-close-error"
          class="command-dialog-error"
          role="status"
          hidden
        ></p>
        <div class="command-dialog-actions">
          <button id="space-close-cancel" type="button">Cancel</button>
          <button
            id="space-close-confirm"
            class="destructive-action"
            type="button"
          >
            Press Enter to confirm
          </button>
        </div>
      </div>
    </section>
    <div
      id="tree-context-menu"
      class="tree-context-menu"
      role="menu"
      aria-label="Tab and Pane actions"
      hidden
    >
      <button id="tree-context-rename" type="button" role="menuitem">
        Rename
      </button>
      <button
        id="tree-context-close"
        class="tree-context-destructive"
        type="button"
        role="menuitem"
      >
        Close Pane
      </button>
      <p
        id="tree-context-error"
        class="tree-context-error"
        role="status"
        hidden
      ></p>
    </div>
    <div
      id="shortcut-toast"
      class="shortcut-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-hidden="true"
    ></div>
    <p id="fleet-status" class="sr-only" role="status">
      Connecting to Fleet.
    </p>`;
}
