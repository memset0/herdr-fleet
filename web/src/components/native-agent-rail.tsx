import { AgentList } from "@/components/agent-list";
import { t } from "@/lib/i18n";
import type { AgentView, BridgeStatus } from "@/lib/types";
import { useLocale } from "@/hooks/use-locale";

interface NativeAgentRailProps {
  agents: AgentView[];
  bridge?: BridgeStatus | undefined;
  error?: boolean;
  lastSeenAt?: number;
  onOpen: (agent: AgentView) => void;
}

export function NativeAgentRail({
  agents,
  bridge,
  error = false,
  lastSeenAt,
  onOpen,
}: NativeAgentRailProps) {
  useLocale();
  return (
    <section aria-label={t("fleet.navigation.agents")} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AgentList
          agents={agents}
          bridge={bridge}
          onOpen={onOpen}
          error={error}
          lastSeenAt={lastSeenAt}
        />
      </div>
    </section>
  );
}
