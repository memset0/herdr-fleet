function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function loginPage(returnPath: string, message = ""): string {
  const alert = message === "" ? "" : `<p id="login-alert" class="alert" role="alert">${escapeHtml(message)}</p>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>Sign in · Herdr Fleet</title>
  <link rel="stylesheet" href="/auth/app.css">
</head>
<body>
  <main class="login-shell">
    <section class="login-panel" aria-labelledby="login-title">
      <p class="product-name">Herdr Fleet</p>
      <div class="login-card">
        <h1 id="login-title">Sign in</h1>
        <p id="login-description">Continue to your agent fleet.</p>
        ${alert}
        <form method="post" action="/auth/login" autocomplete="on" aria-describedby="login-description">
          <input type="hidden" name="next" value="${escapeHtml(returnPath)}">
          <label for="username">Username</label>
          <input id="username" name="username" type="text" autocomplete="username" maxlength="64" required autofocus>
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" maxlength="512" required>
          <button type="submit">Sign in</button>
        </form>
      </div>
    </section>
  </main>
</body>
</html>`;
}

export const LOGIN_CSS = `
@font-face {
  font-family: "Aldrich";
  src: url("/fonts/ui-aldrich-1.002-latin.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
:root {
  color-scheme: light dark;
  font-synthesis-weight: none;
  --radius: 2px;
  --background: light-dark(oklch(.97 0 0), oklch(.145 0 0));
  --foreground: light-dark(oklch(.145 0 0), oklch(.985 0 0));
  --card: light-dark(oklch(1 0 0), oklch(.205 0 0));
  --primary: light-dark(oklch(.205 0 0), oklch(.922 0 0));
  --primary-foreground: light-dark(oklch(.985 0 0), oklch(.205 0 0));
  --muted-foreground: light-dark(oklch(.48 0 0), oklch(.708 0 0));
  --border: light-dark(oklch(.922 0 0), oklch(1 0 0 / 12%));
  --input: light-dark(oklch(.922 0 0), oklch(1 0 0 / 15%));
  --ring: light-dark(oklch(.62 0 0), oklch(.556 0 0));
  --destructive: light-dark(oklch(.577 .245 27.325), oklch(.704 .191 22.216));
  font-family: "Aldrich", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--background); color: var(--foreground); }
button, input { font: inherit; }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.login-shell {
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  place-items: center;
  padding: max(1.25rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1.25rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
}
.login-panel { width: min(100%, 24rem); }
.product-name { margin: 0 0 .75rem; font-size: .78rem; letter-spacing: .04em; }
.login-card { border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); padding: 1.5rem; }
h1 { margin: 0; font-size: 1.5rem; line-height: 1.2; }
#login-description { margin: .45rem 0 1.25rem; color: var(--muted-foreground); font-size: .875rem; }
.alert { margin: 0 0 1rem; border-left: 2px solid var(--destructive); padding: .6rem .75rem; font-size: .8rem; }
form { display: grid; gap: .65rem; }
label { margin-top: .35rem; font-size: .78rem; }
input { width: 100%; min-height: 2.75rem; border: 1px solid var(--input); border-radius: var(--radius); background: var(--background); padding: .65rem .75rem; color: var(--foreground); }
button { min-height: 2.75rem; margin-top: .4rem; border: 0; border-radius: var(--radius); background: var(--primary); padding: .65rem 1rem; color: var(--primary-foreground); cursor: pointer; }
@media (max-width: 30rem) { .login-card { padding: 1.25rem; } }
@media (max-height: 42rem) { .login-shell { align-items: start; } }
`;
