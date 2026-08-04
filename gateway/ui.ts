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
  <meta name="color-scheme" content="dark">
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

export function fleetPage(): string {
  return documentShell(
    "Fleet · Herdr Web Remote",
    `<main class="fleet-shell">
      <header class="topbar">
        <div><p class="eyebrow">HERDR WEB REMOTE</p><h1>Fleet</h1></div>
        <form method="post" action="/auth/logout"><button class="ghost" type="submit">Sign out</button></form>
      </header>
      <section class="summary" aria-label="Fleet totals">
        <article><span>Nodes</span><strong id="total-nodes">—</strong></article>
        <article><span>Online</span><strong id="total-online">—</strong></article>
        <article><span>Agents</span><strong id="total-agents">—</strong></article>
        <article><span>Working</span><strong id="total-working">—</strong></article>
        <article><span>Blocked</span><strong id="total-blocked">—</strong></article>
      </section>
      <div class="section-heading"><h2>Instances</h2><p id="updated">Connecting…</p></div>
      <section id="nodes" class="node-grid" aria-live="polite"></section>
      <template id="empty-template"><div class="empty">No enabled instances are configured.</div></template>
    </main>`,
    ["/fleet-assets/fleet.css", "/fleet-assets/fleet.js"],
  );
}

export const APP_CSS = `
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e7edf7;background:#08111f;font-synthesis:none}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 12% 12%,#1d3b65 0,transparent 36%),radial-gradient(circle at 90% 5%,#183f35 0,transparent 32%),#08111f}.login-shell{min-height:100vh;display:grid;place-items:center;padding:28px}.login-card{width:min(100%,420px);padding:36px;border:1px solid #ffffff1c;border-radius:24px;background:#0c1728e8;box-shadow:0 24px 80px #0008;backdrop-filter:blur(18px)}.mark{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(145deg,#73e0bd,#4a8fef);color:#071521;font-size:24px;font-weight:900;margin-bottom:28px}.eyebrow{margin:0 0 8px;color:#73e0bd;font-size:11px;letter-spacing:.18em;font-weight:750}.login-card h1{font-size:32px;letter-spacing:-.04em;margin:0}.lede{color:#9aa9bd;line-height:1.5;margin:10px 0 26px}.alert{padding:11px 13px;border:1px solid #f2858540;border-radius:10px;background:#3d1823;color:#ffbdc5;font-size:14px}form{display:grid;gap:16px}label{display:grid;gap:7px;color:#b6c3d5;font-size:13px;font-weight:650}input{appearance:none;width:100%;padding:12px 13px;border:1px solid #ffffff24;border-radius:11px;background:#07101d;color:#f5f8fc;font:inherit;outline:none}input:focus{border-color:#64cdae;box-shadow:0 0 0 3px #64cdae22}button{appearance:none;border:0;border-radius:11px;padding:12px 16px;background:#68d7b5;color:#062019;font:inherit;font-weight:800;cursor:pointer}button:hover{filter:brightness(1.06)}.fineprint{text-align:center;color:#65758b;font-size:12px;margin:24px 0 0}
`;

export const FLEET_CSS = `
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e8eef8;background:#08111f;font-synthesis:none}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 0 0,#163659 0,transparent 32%),#08111f}.fleet-shell{width:min(1180px,calc(100% - 36px));margin:auto;padding:38px 0 72px}.topbar{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:28px}.eyebrow{margin:0 0 6px;color:#71daba;font-size:11px;letter-spacing:.18em;font-weight:800}.topbar h1{margin:0;font-size:40px;letter-spacing:-.045em}.ghost{border:1px solid #ffffff20;background:#ffffff0b;color:#c9d5e6;padding:10px 14px;border-radius:10px;cursor:pointer}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:34px}.summary article{padding:18px;border:1px solid #ffffff14;border-radius:16px;background:#0d192bca}.summary span{display:block;color:#8090a6;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.summary strong{display:block;font-size:29px;margin-top:7px;letter-spacing:-.04em}.section-heading{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:13px}.section-heading h2{font-size:17px;margin:0}.section-heading p{font-size:12px;color:#718198;margin:0}.node-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.node{border:1px solid #ffffff15;border-radius:18px;background:#0c1829e8;padding:20px;box-shadow:0 14px 45px #0003}.node-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.node h3{font-size:19px;margin:0 0 5px}.node-host{color:#7f91a8;font-size:12px}.pill{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border-radius:999px;background:#ffffff0d;color:#aebbd0;font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.05em}.pill:before{content:"";width:7px;height:7px;border-radius:50%;background:#6f7c8c}.pill.online{color:#8ce8c9;background:#15352e}.pill.online:before{background:#6ee0ba;box-shadow:0 0 10px #6ee0ba}.pill.herdr-down,.pill.bridge-down,.pill.transport-down{color:#ffbdc5;background:#3a1a25}.pill.herdr-down:before,.pill.bridge-down:before,.pill.transport-down:before{background:#f27d8f}.labels{display:flex;flex-wrap:wrap;gap:6px;margin:15px 0}.label{padding:4px 7px;border-radius:7px;background:#14243a;color:#8fa4bd;font-size:11px}.node-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.node-stats div{padding:10px;border-radius:10px;background:#07111f}.node-stats span{display:block;font-size:10px;color:#6f8199;text-transform:uppercase}.node-stats b{font-size:18px}.message{font-size:12px;color:#e7a9b2;margin:11px 0}.sessions{display:grid;gap:7px;margin-top:14px}.session{display:flex;align-items:center;justify-content:space-between;gap:10px;text-decoration:none;color:#dce6f5;padding:10px 11px;border:1px solid #ffffff10;border-radius:11px;background:#ffffff07}.session:hover{border-color:#66d6b74d;background:#66d6b70d}.session-name{font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis}.session-meta{white-space:nowrap;color:#7f91a8;font-size:11px}.open-node{display:inline-block;margin-top:15px;color:#74ddbd;text-decoration:none;font-size:13px;font-weight:750}.empty{grid-column:1/-1;padding:42px;text-align:center;border:1px dashed #ffffff20;border-radius:16px;color:#8292a7}@media(max-width:760px){.fleet-shell{width:min(100% - 24px,1180px);padding-top:24px}.summary{grid-template-columns:repeat(3,1fr)}.node-grid{grid-template-columns:1fr}}@media(max-width:460px){.summary{grid-template-columns:repeat(2,1fr)}.summary article{padding:14px}.node{padding:16px}.topbar h1{font-size:34px}}
`;

export const FLEET_JS = `
const root=document.querySelector('#nodes');
const text=(id,value)=>{const el=document.querySelector(id);if(el)el.textContent=String(value)};
const escapeHtml=(value)=>String(value).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sessionHref=(node,session)=>{const url=new URL('https://'+node.publicHost+'/');if(!session.isPrimary)url.searchParams.set('session',session.name);return url.toString()};
function render(data){
 text('#total-nodes',data.totals.nodes);text('#total-online',data.totals.online);text('#total-agents',data.totals.agents);text('#total-working',data.totals.working);text('#total-blocked',data.totals.blocked);
 text('#updated','Updated '+new Date(data.generatedAt).toLocaleTimeString());
 if(!data.nodes.length){root.innerHTML='<div class="empty">No enabled instances are configured.</div>';return}
 root.innerHTML=data.nodes.map((node)=>{
   const labels=node.labels.map((label)=>'<span class="label">'+escapeHtml(label)+'</span>').join('');
   const sessions=node.sessions.map((session)=>'<a class="session" href="'+sessionHref(node,session)+'"><span class="session-name">'+escapeHtml(session.name)+(session.isPrimary?' <small>primary</small>':'')+'</span><span class="session-meta">'+session.agents+' agents · '+session.working+' working · '+session.blocked+' blocked</span></a>').join('');
   const message=node.message?'<p class="message">'+escapeHtml(node.message)+'</p>':'';
   return '<article class="node"><div class="node-head"><div><h3>'+escapeHtml(node.name)+'</h3><div class="node-host">'+escapeHtml(node.publicHost)+'</div></div><span class="pill '+node.health+'">'+escapeHtml(node.health.replaceAll('-',' '))+'</span></div><div class="labels">'+labels+'</div><div class="node-stats"><div><span>Agents</span><b>'+node.agents+'</b></div><div><span>Working</span><b>'+node.working+'</b></div><div><span>Blocked</span><b>'+node.blocked+'</b></div></div>'+message+'<div class="sessions">'+sessions+'</div><a class="open-node" href="https://'+node.publicHost+'/">Open Collie →</a></article>';
 }).join('');
}
async function refresh(){try{const response=await fetch('/api/fleet',{headers:{accept:'application/json'},cache:'no-store'});if(response.status===401){location.href='/auth/login?next='+encodeURIComponent(location.href);return}if(!response.ok)throw new Error('HTTP '+response.status);render(await response.json())}catch(error){text('#updated','Refresh failed · '+error.message)}}
refresh();setInterval(refresh,5000);
`;
