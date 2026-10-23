import { Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { TOOLBAR_TAP_TARGET } from "@/components/ui/tap-target";
import { ft, useFleetLocale } from "@/lib/fleet-i18n";

export interface FleetTerminalComposerProps {
  /** The terminal is attached and answering; until then Send refuses and the draft is kept. */
  readonly ready: boolean;
  /** Write the draft into the terminal. True only when every byte was accepted. */
  readonly onSend: (text: string) => Promise<boolean>;
}

/**
 * The terminal surface's input box: Collie's own field and the composer box's frame, with a send
 * that is Fleet's (`fleet/ui/terminal/composer.ts`) and never Collie's checked pipeline. Keys are
 * Collie's composer's: Ctrl/Cmd+Enter sends, Enter is a line break — the field's `enterKeyHint`
 * already promises the on-screen keyboard that much.
 */
export function FleetTerminalComposer({ ready, onSend }: FleetTerminalComposerProps) {
  useFleetLocale();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const canSend = ready && !sending && draft.trim() !== "";

  const send = async (): Promise<void> => {
    if (!canSend) return;
    setSending(true);
    try {
      const sent = draft;
      // Cleared only after a write the connection accepted; a refused one keeps every character.
      if (await onSend(sent)) setDraft((current) => (current === sent ? "" : current));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-2 pb-2 pt-1" data-testid="fleet-terminal-composer">
      <div className="relative flex items-end gap-1 rounded-xl border border-input bg-background p-1 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
        <ChatInput
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void send();
          }}
          placeholder={ft("fleet.terminal.composer.placeholder")}
          aria-label={ft("fleet.terminal.composer.placeholder")}
          autoCorrect="off"
          spellCheck={false}
          rows={1}
          className="min-h-9 min-w-0 flex-1 py-1.5 pl-2 font-mono"
        />
        <Button
          type="button"
          size="icon"
          className={`${TOOLBAR_TAP_TARGET} size-9 shrink-0 rounded-full`}
          disabled={!canSend}
          onClick={() => void send()}
          title={ready ? undefined : ft("fleet.terminal.composer.notReady")}
          aria-label={ready ? ft("fleet.terminal.composer.send") : ft("fleet.terminal.composer.notReady")}
          data-testid="fleet-terminal-composer-send"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
