import { describe, expect, test } from "bun:test";

import { APP_CSS, GATEWAY_THEME_CSS, loginPage } from "./ui.ts";

describe("Gateway login UI", () => {
  test("renders the script-free single-account form with explicit accessible labels", () => {
    const page = loginPage("https://fleet.example.com/?instance=node-a");

    expect(page).toContain('<main class="login-shell">');
    expect(page).toContain(
      '<section class="login-panel" aria-labelledby="login-title">',
    );
    expect(page).toContain('<h1 id="login-title">Sign in</h1>');
    expect(page).toContain("Herdr Web Remote");
    expect(page).toContain(
      '<form method="post" action="/auth/login" autocomplete="on" aria-describedby="login-description">',
    );
    expect(page).toContain(
      '<input type="hidden" name="next" value="https://fleet.example.com/?instance=node-a">',
    );
    expect(page).toContain('<label for="username">Username</label>');
    expect(page).toContain(
      'id="username" name="username" type="text" autocomplete="username" maxlength="64" required autofocus',
    );
    expect(page).toContain('<label for="password">Password</label>');
    expect(page).toContain(
      'id="password" name="password" type="password" autocomplete="current-password" maxlength="512" required',
    );
    expect(page).toContain(
      '<button class="primary-action" type="submit">Sign in</button>',
    );
    expect(page).toContain('<link rel="stylesheet" href="/auth/app.css">');
    expect(page).not.toContain("<script");
    expect(page).not.toContain("Welcome back");
    expect(page).not.toContain("One private account");
  });

  test("escapes the generic alert and validated return value without echoing fields", () => {
    const page = loginPage(
      'https://fleet.example.com/\"><img src=x onerror="return-leak">',
      '<img src=x onerror="message-leak"> Invalid username or password.',
    );

    expect(page).toContain('id="login-alert" class="alert" role="alert"');
    expect(page).toContain(
      "&lt;img src=x onerror=&quot;message-leak&quot;&gt; Invalid username or password.",
    );
    expect(page).toContain(
      "https://fleet.example.com/&quot;&gt;&lt;img src=x onerror=&quot;return-leak&quot;&gt;",
    );
    expect(page).not.toContain('<img src=x onerror="message-leak">');
    expect(page).not.toContain('<img src=x onerror="return-leak">');
    expect(page).not.toContain('name="username" value=');
    expect(page).not.toContain('name="password" value=');
  });

  test("uses the shared adaptive theme without the retired ornamental treatment", () => {
    expect(APP_CSS.startsWith(GATEWAY_THEME_CSS)).toBeTrue();
    expect(GATEWAY_THEME_CSS).toContain("color-scheme: light dark");
    expect(GATEWAY_THEME_CSS).toContain("--radius: .65rem");
    expect(GATEWAY_THEME_CSS).toContain("--background: light-dark(");
    expect(GATEWAY_THEME_CSS).toContain("--primary: light-dark(");
    expect(GATEWAY_THEME_CSS).toContain("--ring: light-dark(");
    expect(GATEWAY_THEME_CSS).toContain(
      ":focus-visible { outline: 2px solid var(--ring)",
    );
    expect(APP_CSS).toContain("min-height: 100dvh");
    expect(APP_CSS).toContain("env(safe-area-inset-top)");
    expect(APP_CSS).toContain("@media (max-width: 30rem)");
    expect(APP_CSS).toContain("@media (max-height: 42rem)");
    expect(APP_CSS).toContain("min-height: 2.75rem");
    expect(APP_CSS).not.toContain("radial-gradient");
    expect(APP_CSS).not.toContain("linear-gradient");
    expect(APP_CSS).not.toContain("backdrop-filter");
    expect(APP_CSS).not.toContain("border-radius:24px");
    expect(APP_CSS).not.toContain("#73e0bd");
  });
});
