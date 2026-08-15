export { FLEET_CSS, FLEET_JS, fleetPage } from "./fleet-ui.ts";

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
  const alert = message ? `<p class="alert" role="alert">${escapeHtml(message)}</p>` : "";
  return documentShell(
    "Sign in · Herdr Web Remote",
    `<main class="login-shell">
      <section class="login-card">
        <div class="mark" aria-hidden="true">H</div>
        <p class="eyebrow">HERDR WEB REMOTE</p>
        <h1>Welcome back</h1>
        <p class="lede">Sign in to monitor every configured Herdr instance.</p>
        ${alert}
        <form method="post" action="/auth/login" autocomplete="on">
          <input type="hidden" name="next" value="${escapeHtml(next)}">
          <label>Username<input name="username" type="text" autocomplete="username" maxlength="64" required autofocus></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" maxlength="512" required></label>
          <button type="submit">Sign in</button>
        </form>
        <p class="fineprint">One private account · Secure cross-subdomain session</p>
      </section>
    </main>`,
    ["/auth/app.css"],
  );
}

export const APP_CSS = `
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e7edf7;background:#08111f;font-synthesis:none}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 12% 12%,#1d3b65 0,transparent 36%),radial-gradient(circle at 90% 5%,#183f35 0,transparent 32%),#08111f}.login-shell{min-height:100vh;display:grid;place-items:center;padding:28px}.login-card{width:min(100%,420px);padding:36px;border:1px solid #ffffff1c;border-radius:24px;background:#0c1728e8;box-shadow:0 24px 80px #0008;backdrop-filter:blur(18px)}.mark{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(145deg,#73e0bd,#4a8fef);color:#071521;font-size:24px;font-weight:900;margin-bottom:28px}.eyebrow{margin:0 0 8px;color:#73e0bd;font-size:11px;letter-spacing:.18em;font-weight:750}.login-card h1{font-size:32px;letter-spacing:-.04em;margin:0}.lede{color:#9aa9bd;line-height:1.5;margin:10px 0 26px}.alert{padding:11px 13px;border:1px solid #f2858540;border-radius:10px;background:#3d1823;color:#ffbdc5;font-size:14px}form{display:grid;gap:16px}label{display:grid;gap:7px;color:#b6c3d5;font-size:13px;font-weight:650}input{appearance:none;width:100%;padding:12px 13px;border:1px solid #ffffff24;border-radius:11px;background:#07101d;color:#f5f8fc;font:inherit;outline:none}input:focus{border-color:#64cdae;box-shadow:0 0 0 3px #64cdae22}button{appearance:none;border:0;border-radius:11px;padding:12px 16px;background:#68d7b5;color:#062019;font:inherit;font-weight:800;cursor:pointer}button:hover{filter:brightness(1.06)}.fineprint{text-align:center;color:#65758b;font-size:12px;margin:24px 0 0}
`;
