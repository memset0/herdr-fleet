import { expect, test } from "@playwright/test";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

test.use({ serviceWorkers: "block" });

test("right sidebar switches independently and terminal associations survive a workspace move", async ({ page }) => {
  await page.setViewportSize({ width: 1720, height: 1100 });
  await installApiStub(page);
  let moved = false;
  const terminal = { version: 1, host: "", session: "default", id: "herdr:term_original" };
  const row = `fleet-terminal:v1:${JSON.stringify([1, "", "default", terminal.id])}`;
  const task = { id: "task-one", projectId: "project", parentId: null, sectionId: null, title: "Implement the requirement", description: "Use the task description as the requirement.", completed: false, recurring: false, order: 1, updatedAt: "one", url: "https://app.todoist.com/app/task/task-one" };
  const child = { ...task, id: "task-child", parentId: task.id, title: "Nested requirement" };
  const link = { id: "link-one", terminal, kind: "todoist", resource: '["account","project","task-one"]', accountId: "account", projectId: "project", taskId: task.id, state: "linked" };
  const status = { scope: { kind: "filter", id: "parents", name: "Parent tasks" }, configured: true, connected: true, accountId: "account", clientId: "example-client", projects: [{ id: "project", name: "Example project" }], generation: 1, callback: "https://example.com/fleet/todoist/callback", links: [link] };
  await page.addInitScript(({ pinRow }) => {
    localStorage.setItem("collie:pins:v1", JSON.stringify([{ row: pinRow, space: "@terminal", at: 1 }]));
  }, { pinRow: row });
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((pane, index) => {
      if (index !== 0) return pane;
      const result = Object.assign({}, pane, { bindingId: terminal.id, bindingSession: "default" });
      if (moved) Object.assign(result, { paneId: "w2:p77", workspaceId: "w2", workspaceLabel: "Moved project", workspaceNumber: 2, tabId: "w2:t1" });
      return result;
    }),
  } }));
  await page.route("**/fleet/api/pane-tags", (route) => route.fulfill({ json: { version: "one", document: { schemaVersion: 1, tags: [{ id: "tag-one", name: "Review", color: "#64748b" }], panes: [{ row, space: "@terminal", tags: ["tag-one"] }] } } }));
  await page.route("**/fleet/api/todoist/status", (route) => route.fulfill({ json: status }));
  await page.route("**/fleet/api/todoist/choices", (route) => route.fulfill({ json: { projects: status.projects, filters: [{ id: "parents", name: "Parent tasks", query: "!subtask" }] } }));
  await page.route("**/fleet/api/todoist/tasks*", (route) => route.fulfill({ json: { ...status, tasks: [task], treeTasks: [task, child], contextTasks: [], sections: [], boundTasks: [task] } }));
  await page.route(/\/api\/pane\/w2(?:%3A|:)p77(?:\?.*)?$/, (route) => route.fulfill({ json: { paneId: "w2:p77", text: "Example output", truncated: false, revision: 1 } }));
  await page.route("**/fleet/bindings/link-one", (route) => route.fulfill({ status: 303, headers: { location: "/pane/w2%3Ap77?s=default" }, body: "" }));
  await page.goto(`/pane/${encodeURIComponent(fixtureSnapshot.agents[0]!.paneId)}`);
  const rail = page.getByRole("complementary", { name: "Agents / Todoist" });
  await expect(rail.locator('[data-slot="agent-pin"][aria-pressed="true"]')).toHaveCount(1);
  await expect(rail.getByText("Review", { exact: true })).toBeVisible();
  const originalUrl = page.url();
  await rail.getByRole("button", { name: "Todoist", exact: true }).click();
  await expect(rail.getByRole("region", { name: "Bound to this terminal" })).toContainText(task.title);
  expect(page.url()).toBe(originalUrl);
  await expect(rail.getByRole("button", { name: /^Nested requirement/ })).toBeVisible();
  await rail.getByRole("button", { name: "List", exact: true }).click();
  await expect(rail.getByRole("button", { name: /^Nested requirement/ })).toHaveCount(0);
  await rail.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(rail.getByRole("button", { name: /^Nested requirement/ })).toBeVisible();
  const parentBox = await rail.locator("li").filter({ hasText: task.title }).locator("button").last().boundingBox();
  const childBox = await rail.locator("li").filter({ hasText: child.title }).locator("button").last().boundingBox();
  expect(childBox!.x).toBeGreaterThan(parentBox!.x);
  const checkboxTarget = await rail.getByRole("checkbox", { name: `Complete ${task.title}` }).locator("..").boundingBox();
  expect(checkboxTarget!.height).toBeGreaterThanOrEqual(44);
  expect(checkboxTarget!.width).toBeGreaterThanOrEqual(44);
  const childCard = rail.locator('[data-slot="todoist-task-card"]').filter({ hasText: child.title });
  const heights = await childCard.evaluate(async (card) => {
    const values: number[] = [], start = performance.now();
    card.querySelector<HTMLButtonElement>("button")!.click();
    while (performance.now() - start < 400) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      values.push(Math.round(card.getBoundingClientRect().height));
    }
    return values;
  });
  expect(new Set(heights).size).toBeGreaterThan(3);
  await expect(childCard).toHaveAttribute("data-selected", "true");
  await expect(childCard.getByRole("button", { name: "Edit task", exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("todoist-desktop.png") });
  await rail.getByRole("button", { name: "Agents", exact: true }).click();
  moved = true;
  await page.goto("/fleet/bindings/link-one");
  await expect(rail.locator('[data-slot="agent-pin"][aria-pressed="true"]')).toHaveCount(1);
  await expect(rail.getByText("Review", { exact: true })).toBeVisible();
  await rail.getByRole("button", { name: "Todoist", exact: true }).click();
  await expect(rail.getByRole("region", { name: "Bound to this terminal" })).toContainText(task.title);
  await expect(page).toHaveURL(/pane\/w2%3Ap77/);
  await expect(rail.getByRole("button", { name: "Tree", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("the narrow pane switcher also offers Todoist", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiStub(page);
  await page.route("**/fleet/api/todoist/status", (route) => route.fulfill({ json: { scope: { kind: "all" }, configured: false, connected: false, accountId: null, clientId: null, projects: [], generation: 0, callback: "https://example.com/fleet/todoist/callback", links: [] } }));
  await page.goto(`/pane/${encodeURIComponent(fixtureSnapshot.agents[0]!.paneId)}`);
  await page.getByRole("button", { name: /^Switch pane/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Todoist", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Connect Todoist in Settings to view tasks from all projects.");
});

test("OAuth continuation restores the Strict cookie and sends an explicit same-origin request", async ({ page, context }) => {
  const { oauthLanding, TODOIST_CALLBACK_SCRIPT } = await import("../../fleet/todoist/callback");
  const nonce = "a".repeat(43);
  const callback = `https://example.com/fleet/todoist/callback?state=${nonce}&code=example-code`;
  await context.addCookies([{ name: "example_session", value: "example-value", url: "https://example.com", secure: true, httpOnly: true, sameSite: "Strict" }]);
  let initialCookie = "", postedOrigin = "", postedCookie = "", postedBody = "";
  await page.route("https://provider.example/**", (route) => route.fulfill({ contentType: "text/html", body: `<a href="${callback}">Return to Fleet</a>` }));
  await page.route("https://example.com/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/fleet/todoist/callback.js") return route.fulfill({ contentType: "text/javascript", body: TODOIST_CALLBACK_SCRIPT });
    if (url.pathname === "/fleet/todoist/callback") {
      initialCookie = (await route.request().allHeaders()).cookie ?? "";
      const response = oauthLanding(url);
      return route.fulfill({ contentType: "text/html", headers: { ...Object.fromEntries(response.headers), "referrer-policy": "no-referrer" }, body: await response.text() });
    }
    if (url.pathname === "/fleet/api/todoist/callback") {
      const headers = await route.request().allHeaders();
      postedOrigin = headers.origin ?? ""; postedCookie = headers.cookie ?? ""; postedBody = route.request().postData() ?? "";
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ contentType: "text/html", body: "Connected" });
  });
  await page.goto("https://provider.example/authorize");
  await page.getByRole("link", { name: "Return to Fleet" }).click();
  await expect(page).toHaveURL("https://example.com/fleet/todoist/callback");
  await page.getByRole("button", { name: "Continue to Fleet" }).click();
  await expect(page).toHaveURL("https://example.com/settings?todoist=connected");
  expect(initialCookie).not.toContain("example_session");
  expect(postedCookie).toContain("example_session=example-value");
  expect(postedOrigin).toBe("https://example.com");
  expect(JSON.parse(postedBody)).toEqual({ state: nonce, code: "example-code" });
});


test("settings shows configured app state and the Connect action reaches OAuth", async ({ page }) => {
  await installApiStub(page);
  await page.route("**/fleet/api/todoist/status", (route) => route.fulfill({ json: { scope: { kind: "all" }, configured: true, connected: false, clientId: "example-client", accountId: null, generation: 0, callback: "https://example.com/fleet/todoist/callback", links: [] } }));
  await page.route("**/fleet/api/todoist/connect", (route) => route.fulfill({ json: { url: "https://app.todoist.com/oauth/authorize?client_id=example-client&state=example-state" } }));
  await page.route("https://app.todoist.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Provider authorization</h1>" }));
  await page.goto("/settings");
  await expect(page.getByRole("textbox", { name: "Client ID", exact: true })).toHaveValue("example-client");
  await expect(page.getByText("Client secret is configured and kept on the server.")).toBeVisible();
  await page.getByRole("button", { name: "Connect Todoist", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Provider authorization" })).toBeVisible();
});
