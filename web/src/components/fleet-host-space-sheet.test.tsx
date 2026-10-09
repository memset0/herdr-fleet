// A Host row's "New workspace" reuses Collie's new-space sheet with the Host fixed
// (FORK.toml host-workspace-form-port): no picker, no fallback to another machine, and the scope the
// caller supplied, explicit even for the lead.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NewSpaceSheet } from "./new-space-sheet";
import { CrewProvider } from "./crew-provider";
import { fixtureServers } from "@/test/handlers";
import type { Scope } from "@/lib/scope";
import type { ServerSummary } from "@/lib/types";

const solo: ServerSummary[] = [fixtureServers[0]!];

function mount(
  servers: ServerSummary[],
  props: { onCreate: (opts: { label?: string; cwd?: string }, at?: Scope) => void; scope: Scope; fixedHost: string },
) {
  return render(
    <CrewProvider servers={servers} ts={1_000} pollMs={3_000}>
      <NewSpaceSheet open onClose={() => {}} onCreate={props.onCreate} scope={props.scope} fixedHost={props.fixedHost} />
    </CrewProvider>,
  );
}

const hostRow = () => screen.queryByRole("radiogroup");

describe("NewSpaceSheet — fixed Host", () => {
  it("keeps a peer fixed with no picker and emits its explicit primary scope", async () => {
    const onCreate = vi.fn();
    mount(fixtureServers, { fixedHost: "workshop", scope: { host: "workshop" }, onCreate });
    expect(hostRow()).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: /create space/i }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith({ label: undefined, cwd: undefined }, { host: "workshop" });
  });

  it("does not fall back from a refusing fixed Host", () => {
    const onCreate = vi.fn();
    mount(fixtureServers, { fixedHost: "attic", scope: { host: "attic" }, onCreate });
    expect(hostRow()).toBeNull();
    expect(screen.getByRole("button", { name: /create space/i })).toBeDisabled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("emits an explicit empty scope for the fixed lead rather than an ambient one", async () => {
    const onCreate = vi.fn();
    mount(solo, { fixedHost: fixtureServers[0]!.id, scope: {}, onCreate });
    await userEvent.setup().click(screen.getByRole("button", { name: /create space/i }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith({ label: undefined, cwd: undefined }, {});
  });
});
