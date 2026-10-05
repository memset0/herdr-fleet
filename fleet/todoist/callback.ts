/** No exchange on this cross-site GET. The continuation fetch restores Strict-cookie eligibility without accepting null Origin. */
export function oauthLanding(url: URL): Response {
  const state = url.searchParams.get("state") ?? "", code = url.searchParams.get("code") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !code || code.length > 4096) return new Response("Todoist authorization was not completed.", { status: 400 });
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect Todoist</title><link rel="stylesheet" href="/auth/app.css"><script src="/fleet/todoist/callback.js" defer></script><main><h1>Connect Todoist</h1><p id="todoist-message">Continue to confirm this connection with your Fleet session.</p><form id="todoist-continue"><button id="todoist-submit" type="submit">Continue to Fleet</button></form><a href="/settings">Fleet Settings</a></main></html>`, {
    headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'" },
  });
}

/** Fixed same-origin script: no credential or request value is embedded in this asset. */
export const TODOIST_CALLBACK_SCRIPT = `
const parameters = new URLSearchParams(location.search);
const state = parameters.get("state");
const code = parameters.get("code");
history.replaceState(null, "", location.pathname);
const form = document.getElementById("todoist-continue");
const button = document.getElementById("todoist-submit");
const message = document.getElementById("todoist-message");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  try {
    const response = await fetch("/fleet/api/todoist/callback", {
      method: "POST", headers: { "content-type": "application/json" },
      credentials: "same-origin", body: JSON.stringify({ state, code })
    });
    if (response.ok) { location.replace("/settings?todoist=connected"); return; }
  } catch {}
  message.textContent = "Open Fleet Settings to check the connection or start authorization again.";
});
`;
