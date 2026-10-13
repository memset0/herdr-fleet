import { expect, test, type Page } from "@playwright/test";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";
import { parseJson } from "@/lib/json";
import { parseViewCommand, type ViewSnapshot } from "../../fleet/view-state/document.ts";
import { equalReference } from "../../fleet/view-state/document.ts";
import { createViewPresence } from "../../fleet/view-state/presence.ts";
import { terminalReference } from "../../fleet/bindings/identity.ts";

test.use({ serviceWorkers: "block" });
test.skip(process.env.VITE_HERDR_FLEET !== "1", "needs a Fleet build");

const ordinaryRows = (viewer: Page) => viewer.locator('[data-slot="native-agent-card"] button').filter({ hasText: "Example Agent" });

const names = (scope: ReturnType<Page["locator"]>) => scope.locator('[data-slot="native-agent-card"] [data-glide="name"]').allTextContents();

async function world(pages: Page[]) {
  const snapshot = structuredClone(fixtureSnapshot);
  snapshot.agents = snapshot.agents.map((agent, index) => ({ ...agent, paneLabel: `Example Agent ${index + 1}`, status: "working",
    bindingId: `herdr:term_${index}`, bindingSession: "default", session: "default", cwd: "/example" }));
  const view: ViewSnapshot = { generation: "example", revision: 0, selection: null, rows: 3, columns: 4,
    slots: Array.from({ length: 12 }, (_, index) => index === 0 ? terminalReference(snapshot.agents[0]!) : null) };
  const presence = createViewPresence();
  let selections = 0;
  let reads = 0, snapshotReads = 0;
  for (const page of pages) {
    await installApiStub(page);
    await page.route("**/fleet/api/view-presence", async (route) => {
      const pulse = JSON.parse(route.request().postData() ?? "{}");
      const active = presence.pulse("example", pulse.id, pulse.sequence, pulse.active);
      await route.fulfill({ json: { active } });
    });
    await page.route("**/api/snapshot*", (route) => { snapshotReads += 1; return route.fulfill({ json: snapshot }); });
    await page.route("**/fleet/api/view-state", async (route) => {
      if (route.request().method() === "GET") reads += 1;
      if (route.request().method() === "POST") {
        const command = parseViewCommand(parseJson(route.request().postData() ?? ""));
        if (!command) { await route.fulfill({ status: 400, json: { error: "invalid" } }); return; }
        if (command.type === "select") { selections += 1; Object.assign(view, { selection: command.terminal, revision: view.revision + 1 }); }
        if (command.type === "slot") Object.assign(view, { slots: view.slots.map((entry, index) => index === command.index ? command.terminal : command.terminal && equalReference(entry, command.terminal) ? null : entry) });
        if (command.type === "layout") Object.assign(view, { rows: command.rows, columns: command.columns,
          slots: Array.from({ length: command.rows * command.columns }, (_, index) => view.slots[index] ?? null) });
      }
      await route.fulfill({ json: view });
    });
  }
  return { snapshot, selections: () => selections, reads: () => reads, snapshotReads: () => snapshotReads };
}

test("portrait and landscape reserve the queue, resize at its bottom, and exit to ordinary Fleet", async ({ page }, info) => {
  test.skip(info.project.name.startsWith("states"), "the playground has no panel route");
  await world([page]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/panel");
  const queue = page.locator('[data-slot="panel-agent-queue"]');
  await expect(queue.locator('[data-slot="native-agent-card"]')).toHaveCount(2);
  const first = page.locator("[data-panel-slot]").first();
  const tile = await first.boundingBox();
  expect(tile!.width).toBeCloseTo(tile!.height, 0);
  const grid = page.locator(".fleet-panel-grid-region");
  const portraitGrid = await grid.boundingBox(), portraitQueue = await queue.boundingBox();
  expect(portraitQueue!.y).toBeGreaterThanOrEqual(portraitGrid!.y + portraitGrid!.height - 1);
  expect(portraitQueue!.height).toBeGreaterThan(250);
  // The small grid consumes only its actual square content, not half the viewport.
  const contentHeight = await page.locator(".fleet-panel-grid").evaluate((element) => element.getBoundingClientRect().height);
  expect(portraitGrid!.height).toBeCloseTo(contentHeight + 16, 0);
  expect(portraitQueue!.height).toBeGreaterThan(450);
  await page.screenshot({ path: info.outputPath("portrait.png") });
  await queue.getByRole("combobox", { name: "Rows", exact: true }).selectOption("6");
  await expect(page.locator("[data-panel-slot]")).toHaveCount(24);
  expect((await queue.boundingBox())!.height).toBeGreaterThan(250);
  await page.setViewportSize({ width: 844, height: 390 });
  const landscapeGrid = await grid.boundingBox(), landscapeQueue = await queue.boundingBox();
  expect(landscapeQueue!.x).toBeGreaterThanOrEqual(landscapeGrid!.x + landscapeGrid!.width - 1);
  expect(landscapeQueue!.width).toBeGreaterThan(300);
  await page.screenshot({ path: info.outputPath("landscape.png") });
  await queue.getByRole("button", { name: "Exit panel" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-slot="fleet-agent-panel"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-slot="fleet-agent-panel"]')).toHaveCount(0);
});

test("a normal joined viewer follows the panel's central Pane choice exactly once", async ({ page, context }, info) => {
  test.skip(info.project.name.startsWith("states"), "the playground has no panel route");
  const other = await context.newPage();
  const state = await world([page, other]);
  await page.goto("/panel");
  await other.setViewportSize({ width: 1600, height: 900 });
  await other.goto("/");
  for (const viewer of [page, other]) {
    if (new URL(viewer.url()).pathname === "/panel") continue;
    await viewer.getByRole("button", { name: "Join pane selection sync" }).click();
    await expect(viewer.getByRole("button", { name: "Leave pane selection sync" })).toBeVisible();
  }
  await page.locator('[data-slot="panel-agent-queue"] [data-slot="native-agent-card"]').nth(1).locator("button").first().click();
  await expect(other).toHaveURL(/\/pane\/w2%3Ap1\?s=default$/);
  const reads = state.reads();
  await expect.poll(state.reads).toBeGreaterThanOrEqual(reads + 2);
  expect(state.selections()).toBe(1);
  await expect(page).toHaveURL(/\/panel$/);
  await other.close();
});

test("drag replacement, shared selection without echoes, and reduced-motion completion", async ({ page, context }, info) => {
  test.skip(info.project.name.startsWith("states"), "the playground has no panel route");
  const other = await context.newPage();
  const state = await world([page, other]);
  await page.goto("/panel");
  await other.goto("/panel");
  for (const viewer of [page, other]) {
    if (new URL(viewer.url()).pathname === "/panel") continue;
    await viewer.getByRole("button", { name: "Join pane selection sync" }).click();
    await expect(viewer.getByRole("button", { name: "Leave pane selection sync" })).toBeVisible();
  }
  const handle = page.getByRole("button", { name: "Place Example Agent 2 in a slot" });
  const target = page.getByRole("button", { name: "Slot 1", exact: true });
  const from = await handle.boundingBox(), to = await target.boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(target).toContainText("Example Agent 2");
  await expect(other.getByRole("button", { name: "Slot 1", exact: true })).toContainText("Example Agent 2");
  expect(state.selections()).toBe(0);
  await target.click();
  await expect.poll(state.selections).toBe(1);
  await expect(other.locator("[data-panel-slot='0']")).toHaveClass(/ring-primary/);
  await expect(page).toHaveURL(/\/panel$/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  state.snapshot.agents[1]!.status = "done";
  const feedback = page.locator('[data-slot="panel-status-feedback"][data-status="done"]');
  await expect(feedback).toBeVisible();
  expect(await feedback.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await expect.poll(state.selections).toBe(1);
  await other.close();
});

test("real touch handle immediately drags without selecting, and a card tap selects", async ({ page, context }) => {
  const state = await world([page]);
  await page.goto("/panel");
  const card = page.locator('[data-slot="panel-agent-queue"] [data-slot="native-agent-card"]').nth(1).locator("button").first();
  await card.scrollIntoViewIfNeeded();
  const handle = page.getByRole("button", { name: "Place Example Agent 2 in a slot" });
  const from = await handle.boundingBox();
  const target = page.getByRole("button", { name: "Slot 1", exact: true });
  const to = await target.boundingBox();
  const touch = await context.newCDPSession(page);
  const start = { x: from!.x + from!.width / 2, y: from!.y + from!.height / 2 };
  const end = { x: to!.x + to!.width / 2, y: to!.y + to!.height / 2 };
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  await expect(page.locator('[data-slot="panel-drag-preview"]')).toBeVisible();
  for (let step = 1; step <= 10; step++) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{
      x: start.x + (end.x - start.x) * step / 10, y: start.y + (end.y - start.y) * step / 10,
    }] });
  }
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(target).toContainText("Example Agent 2");
  await expect(page.locator('[data-slot="panel-drag-preview"]')).toHaveCount(0);
  expect(state.selections()).toBe(0);
  await card.tap();
  await expect.poll(state.selections).toBe(1);
  await expect(page).toHaveURL(/\/panel$/);
  await page.getByRole("button", { name: "Place Example Agent 1 in a slot" }).tap();
  const alternative = page.getByRole("button", { name: "Slot 2", exact: true });
  await alternative.tap();
  await expect(alternative).toContainText("Example Agent 1");
  expect(state.selections()).toBe(1);
  await touch.detach();
});

test("two ordinary joined viewers publish and follow in both directions", async ({ page, context }) => {
  const other = await context.newPage();
  const state = await world([page, other]);
  for (const viewer of [page, other]) {
    await viewer.setViewportSize({ width: 1600, height: 900 });
    await viewer.goto("/");
    await viewer.getByRole("button", { name: "Join pane selection sync" }).click();
    await expect(viewer.getByRole("button", { name: "Leave pane selection sync" })).toBeVisible();
  }
  await ordinaryRows(page).nth(0).click();
  await expect(other).toHaveURL(/\/pane\/w1%3Ap1/);
  await expect.poll(state.selections).toBe(1);
  await ordinaryRows(other).nth(1).click();
  await expect(page).toHaveURL(/\/pane\/w2%3Ap1/);
  const reads = state.reads();
  await expect.poll(state.reads).toBeGreaterThan(reads + 2);
  expect(state.selections()).toBe(2);
  await other.close();
});

test("real touch card scrolling keeps favorites and selection unchanged", async ({ page, context }) => {
  const state = await world([page]);
  const first = state.snapshot.agents[0]!;
  state.snapshot.agents = Array.from({ length: 20 }, (_, index) => ({ ...first,
    paneId: `w1:p${index + 1}`, bindingId: `herdr:term_${index}`, paneLabel: `Example Agent ${index + 1}` }));
  await page.goto("/panel");
  const queue = page.locator('[data-slot="panel-agent-queue"]');
  await expect(queue.locator('[data-slot="native-agent-card"]')).toHaveCount(20);
  const card = queue.locator('[data-slot="native-agent-card"] button').first();
  await card.scrollIntoViewIfNeeded();
  const from = await card.boundingBox();
  const touch = await context.newCDPSession(page);
  const before = await queue.evaluate((element) => element.scrollTop);
  const point = { x: from!.x + 30, y: from!.y + from!.height / 2 };
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, y: point.y - 40 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, y: point.y - 100 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => queue.evaluate((element) => element.scrollTop)).toBeGreaterThan(before);
  await expect(page.locator('[data-slot="panel-drag-preview"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Slot 1", exact: true })).toContainText("Example Agent 1");
  expect(state.selections()).toBe(0);
  await expect(page).toHaveURL(/\/panel$/);
  await touch.detach();
});


test("merged member snapshots render each Agent once in sidebar time order", async ({ page, context }) => {
  const other = await context.newPage();
  const state = await world([page, other]);
  const base = state.snapshot.agents[0]!;
  state.snapshot.servers = ["member-lead", "member-a", "member-b"].map((id, index) => ({ id,
    name: `Example member ${index}`, isLead: index === 0, reachable: true, protocol: "ok", lastSeenAt: 1 }));
  state.snapshot.agents = state.snapshot.servers.map((server, index) => ({ ...base,
    host: server.id, bindingId: `herdr:term_${index}`, paneLabel: `Example Agent ${index + 1}`,
    lastActiveAt: [100, 300, 200][index]!, lastSeenAt: 1 }));
  await page.goto("/panel");
  const queue = page.locator('[data-slot="panel-agent-queue"]');
  await expect.poll(state.snapshotReads).toBeGreaterThanOrEqual(4);
  await expect(queue.locator('[data-slot="native-agent-card"]')).toHaveCount(3);
  expect((await names(queue)).map((name) => name.trim())).toEqual(["Example Agent 2", "Example Agent 3", "Example Agent 1"]);
  await other.setViewportSize({ width: 1600, height: 900 });
  await other.goto("/");
  await expect(other.locator('[data-slot="native-agent-card"]')).toHaveCount(3);
  expect(await names(queue)).toEqual(await names(other.locator('body')));
  await expect(queue.getByRole("heading", { name: "Working (3)", exact: true })).toBeVisible();
  await other.close();
});


test("independent controller counts other joined tabs and broadcasts without navigating", async ({ page, context }) => {
  test.setTimeout(45_000);
  const first = await context.newPage(), second = await context.newPage();
  const state = await world([page, first, second]);
  await page.goto("/panel");
  const count = page.locator('[data-slot="panel-sync-receivers"]');
  await expect(count).toHaveText("Active sync tabs: 0");
  await expect(page.getByRole("button", { name: "Join pane selection sync" })).toHaveCount(0);
  for (const viewer of [first, second]) {
    await viewer.setViewportSize({ width: 1600, height: 900 });
    await viewer.goto("/");
    await viewer.getByRole("button", { name: "Join pane selection sync" }).click();
  }
  await expect(count).toHaveText("Active sync tabs: 2");
  await page.getByRole("button", { name: "Slot 1", exact: true }).click();
  for (const viewer of [first, second]) await expect(viewer).toHaveURL(/\/pane\/w1%3Ap1/);
  await expect(page).toHaveURL(/\/panel$/);
  expect(state.selections()).toBe(1);
  await first.getByRole("button", { name: "Leave pane selection sync" }).click();
  await expect(count).toHaveText("Active sync tabs: 1");
  await second.close();
  await expect(count).toHaveText("Active sync tabs: 0", { timeout: 20_000 });
  await first.close();
});
