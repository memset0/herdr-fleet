import { expect, test } from "bun:test";
import { HerdrMux } from "../../bridge/mux/herdr/adapter.ts";
import { FakeHerdr } from "../../bridge/mux/herdr/fixture.ts";
import { StateEngine, type EngineSnapshot } from "../../bridge/state-engine.ts";
import { toPaneWire } from "../../bridge/types.ts";
import { narrowPeerBody, parsePeerSnapshot } from "../../bridge/crew/merge.ts";
import { terminalReference } from "./identity.ts";
import { herdrBindingSession } from "./herdr.ts";

class BindingFixture extends FakeHerdr {
  override async sessionSnapshot() {
    const snapshot = await super.sessionSnapshot();
    return { ...snapshot, panes: snapshot.panes.map((pane, index) => Object.assign({}, pane, { terminal_id: `term_fixture${index}` })) };
  }
}

test("identity survives real adapter, engine, wire and peer narrowing", async () => {
  const mux = new HerdrMux(new BindingFixture(), () => [], "work");
  const engine = new StateEngine(mux, 60_000);
  const next = new Promise<EngineSnapshot>((resolve) => engine.onUpdate(resolve));
  engine.start();
  const snapshot = await next.finally(() => engine.stop());
  const panes = [...snapshot.agents, ...snapshot.shellPanes].map((pane) => Object.assign({}, toPaneWire(pane, () => false), { session: "work" }));
  expect(panes.length).toBeGreaterThan(0);
  expect(panes.every((pane) => !pane.bindingId?.includes("term_fixture"))).toBeTrue();
  const parsed = parsePeerSnapshot({ agents: panes, shellPanes: [], sessions: [{ name: "work", isPrimary: true, reachable: true, agents: panes.length, working: 0, blocked: 0 }] });
  const narrow = narrowPeerBody(parsed, { session: "work", widen: false });
  expect(narrow?.agents[0]?.session).toBeUndefined();
  expect(narrow?.agents[0]?.bindingSession).toBe("work");
  expect(terminalReference(narrow!.agents[0]!)).toEqual(terminalReference(panes[0]!));
});

test("legacy adapters omit identity rather than inventing a terminal from its position", async () => {
  const snapshot = await new HerdrMux(new FakeHerdr(), () => []).snapshot();
  expect(snapshot.panes.every((pane) => pane.bindingId === undefined)).toBeTrue();
  expect(herdrBindingSession("/example/config/herdr.sock")).toBe("default");
  expect(herdrBindingSession("/example/config/sessions/work/herdr.sock")).toBe("work");
});
