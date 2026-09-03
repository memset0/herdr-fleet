import { describe, expect, test } from "bun:test";

import { LOGIN_CSS, loginPage } from "./login-ui.ts";

describe("Fleet login presentation", () => {
  test("is script-free, accessible, escaped, and aligned with Collie tokens", () => {
    const page = loginPage('/pane/p1"><img src=x>', 'token"><img src=x>', '<img src=x> Invalid username or password.');
    expect(page).toContain('<form method="post" action="/auth/login" autocomplete="on"');
    expect(page).toContain('name="csrf_token" value="token&quot;&gt;&lt;img src=x&gt;"');
    expect(page).toContain('autocomplete="username"');
    expect(page).toContain('autocomplete="current-password"');
    expect(page).toContain("&lt;img src=x&gt; Invalid username or password.");
    expect(page).toContain('/pane/p1&quot;&gt;&lt;img src=x&gt;');
    expect(page).not.toContain("<script");
    expect(page).not.toContain('name="password" value=');
    expect(LOGIN_CSS).toContain('--radius: 2px');
    expect(LOGIN_CSS).toContain('font-family: "Aldrich"');
    expect(LOGIN_CSS).toContain("color-scheme: light dark");
  });
});
