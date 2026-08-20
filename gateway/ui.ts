export { FLEET_CSS, FLEET_JS, fleetPage } from "./fleet-ui.ts";

import { GATEWAY_THEME_CSS } from "./theme.ts";

export { GATEWAY_THEME_CSS } from "./theme.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function documentShell(title: string, body: string, assets: string[]): string {
  const tags = assets
    .map((asset) =>
      asset.endsWith(".css")
        ? `<link rel="stylesheet" href="${asset}">`
        : `<script type="module" src="${asset}"></script>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)}</title>
  ${tags}
</head>
<body>${body}</body>
</html>`;
}

export function loginPage(next: string, message = ""): string {
  const alert = message
    ? `<p id="login-alert" class="alert" role="alert">${escapeHtml(message)}</p>`
    : "";
  return documentShell(
    "Sign in · Herdr Web Remote",
    `<main class="login-shell">
      <section class="login-panel" aria-labelledby="login-title">
        <header class="product-identity">
          <span class="mark" aria-hidden="true">H</span>
          <span class="product-name">Herdr Web Remote</span>
        </header>
        <div class="login-card">
          <div class="login-heading">
            <h1 id="login-title">Sign in</h1>
            <p id="login-description">Continue to your Herdr Fleet.</p>
          </div>
          ${alert}
          <form method="post" action="/auth/login" autocomplete="on" aria-describedby="login-description">
            <input type="hidden" name="next" value="${escapeHtml(next)}">
            <div class="form-field">
              <label for="username">Username</label>
              <input id="username" name="username" type="text" autocomplete="username" maxlength="64" required autofocus>
            </div>
            <div class="form-field">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" autocomplete="current-password" maxlength="512" required>
            </div>
            <button class="primary-action" type="submit">Sign in</button>
          </form>
        </div>
      </section>
    </main>`,
    ["/auth/app.css"],
  );
}

export const APP_CSS = `${GATEWAY_THEME_CSS}
html, body { min-height: 100%; }
body { margin: 0; background: var(--background); color: var(--foreground); }
.login-shell {
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  place-items: center;
  padding: max(1.25rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1.25rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
}
.login-panel { width: min(100%, 24rem); }
.product-identity {
  display: flex;
  align-items: center;
  gap: .7rem;
  margin-bottom: .75rem;
  padding: 0 .25rem;
}
.mark {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
  background: var(--card);
  color: var(--card-foreground);
  font-size: 1rem;
  font-weight: 900;
  box-shadow: 0 1px 2px light-dark(#0000000a, #00000038);
}
.product-name { font-size: .78rem; font-weight: 750; letter-spacing: .01em; }
.login-card {
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) + 4px);
  background: var(--card);
  color: var(--card-foreground);
  padding: clamp(1.25rem, 5vw, 1.75rem);
  box-shadow: 0 1px 2px light-dark(#0000000a, #00000038), 0 12px 28px light-dark(#0000000a, #00000030);
}
.login-heading { margin-bottom: 1.35rem; }
.login-heading h1 { margin: 0; font-size: 1.5rem; letter-spacing: -.025em; line-height: 1.2; }
.login-heading p { margin: .45rem 0 0; color: var(--muted-foreground); font-size: .875rem; line-height: 1.5; }
.alert {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: .65rem;
  align-items: start;
  margin: 0 0 1rem;
  border: 1px solid color-mix(in oklch, var(--destructive) 42%, var(--border));
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--destructive) 8%, var(--card));
  padding: .7rem .75rem;
  color: var(--foreground);
  font-size: .8rem;
  line-height: 1.4;
}
.alert::before { width: .45rem; height: .45rem; margin-top: .28rem; border-radius: 999px; background: var(--destructive); content: ""; }
form { display: grid; gap: 1rem; }
.form-field { display: grid; gap: .45rem; }
label { color: var(--foreground); font-size: .78rem; font-weight: 650; }
input {
  appearance: none;
  width: 100%;
  min-height: 2.75rem;
  border: 1px solid var(--input);
  border-radius: calc(var(--radius) - 2px);
  background: var(--background);
  padding: .65rem .75rem;
  color: var(--foreground);
  font: inherit;
}
input:hover { border-color: color-mix(in oklch, var(--foreground) 24%, var(--input)); }
input:focus-visible { border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 20%, transparent); }
.primary-action {
  min-height: 2.75rem;
  border: 0;
  border-radius: calc(var(--radius) - 2px);
  background: var(--primary);
  padding: .65rem 1rem;
  color: var(--primary-foreground);
  font-weight: 750;
  cursor: pointer;
}
.primary-action:hover { background: color-mix(in oklch, var(--primary) 88%, var(--primary-foreground)); }
.primary-action:active { transform: translateY(1px); }
@media (max-width: 30rem) {
  .login-shell { padding-right: max(.75rem, env(safe-area-inset-right)); padding-left: max(.75rem, env(safe-area-inset-left)); }
  .login-card { padding: 1.25rem; }
}
@media (max-height: 42rem) { .login-shell { align-items: start; } }
@media (prefers-reduced-motion: reduce) { .primary-action:active { transform: none; } }
`;
