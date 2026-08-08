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

export function fleetPage(): string {
  return documentShell(
    "Fleet · Collie",
    `<main class="fleet-shell">
      <header class="fleet-header">
        <a class="fleet-mark" href="/" aria-label="Fleet home" title="Herdr Fleet">H</a>
        <nav id="instances" class="instance-strip" aria-label="Herdr instances" role="tablist">
          <span class="connecting">Connecting…</span>
        </nav>
        <a id="open-node" class="header-action" href="#" target="_blank" rel="noopener noreferrer" aria-label="Open selected Collie directly" title="Open directly" hidden>↗</a>
        <form class="logout-form" method="post" action="/auth/logout">
          <button class="header-action" type="submit" aria-label="Sign out" title="Sign out">⇥</button>
        </form>
      </header>
      <section id="frame-stage" class="frame-stage" aria-live="polite">
        <iframe id="node-frame" class="node-frame" title="Selected Collie instance" allow="clipboard-read; clipboard-write" hidden></iframe>
        <div id="frame-loading" class="frame-loading" hidden>
          <span class="loading-mark" aria-hidden="true">H</span>
          <span>Opening Collie…</span>
        </div>
        <aside id="node-notice" class="node-notice" role="status" hidden>
          <span id="notice-dot" class="status-dot"></span>
          <span id="notice-text" class="notice-text"></span>
          <button id="retry-frame" class="notice-action" type="button">Retry</button>
        </aside>
        <div id="empty-state" class="empty-state" hidden>
          <span class="empty-mark" aria-hidden="true">H</span>
          <h1 id="empty-title">No instances</h1>
          <p id="empty-copy">No enabled Herdr instances are configured.</p>
          <button id="retry-inventory" class="primary-action" type="button">Try again</button>
        </div>
      </section>
      <p id="fleet-status" class="sr-only" role="status">Connecting to Fleet.</p>
    </main>`,
    ["/fleet-assets/fleet.css", "/fleet-assets/fleet.js"],
  );
}

export const APP_CSS = `
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e7edf7;background:#08111f;font-synthesis:none}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 12% 12%,#1d3b65 0,transparent 36%),radial-gradient(circle at 90% 5%,#183f35 0,transparent 32%),#08111f}.login-shell{min-height:100vh;display:grid;place-items:center;padding:28px}.login-card{width:min(100%,420px);padding:36px;border:1px solid #ffffff1c;border-radius:24px;background:#0c1728e8;box-shadow:0 24px 80px #0008;backdrop-filter:blur(18px)}.mark{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(145deg,#73e0bd,#4a8fef);color:#071521;font-size:24px;font-weight:900;margin-bottom:28px}.eyebrow{margin:0 0 8px;color:#73e0bd;font-size:11px;letter-spacing:.18em;font-weight:750}.login-card h1{font-size:32px;letter-spacing:-.04em;margin:0}.lede{color:#9aa9bd;line-height:1.5;margin:10px 0 26px}.alert{padding:11px 13px;border:1px solid #f2858540;border-radius:10px;background:#3d1823;color:#ffbdc5;font-size:14px}form{display:grid;gap:16px}label{display:grid;gap:7px;color:#b6c3d5;font-size:13px;font-weight:650}input{appearance:none;width:100%;padding:12px 13px;border:1px solid #ffffff24;border-radius:11px;background:#07101d;color:#f5f8fc;font:inherit;outline:none}input:focus{border-color:#64cdae;box-shadow:0 0 0 3px #64cdae22}button{appearance:none;border:0;border-radius:11px;padding:12px 16px;background:#68d7b5;color:#062019;font:inherit;font-weight:800;cursor:pointer}button:hover{filter:brightness(1.06)}.fineprint{text-align:center;color:#65758b;font-size:12px;margin:24px 0 0}
`;

export const FLEET_CSS = `
:root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-synthesis:none;--radius:.65rem;--background:light-dark(oklch(.97 0 0),oklch(.145 0 0));--foreground:light-dark(oklch(.145 0 0),oklch(.985 0 0));--card:light-dark(oklch(1 0 0),oklch(.205 0 0));--muted:light-dark(oklch(.94 0 0),oklch(.269 0 0));--muted-foreground:light-dark(oklch(.48 0 0),oklch(.708 0 0));--accent:light-dark(oklch(.92 0 0),oklch(.269 0 0));--border:light-dark(oklch(.922 0 0),oklch(1 0 0/12%));--ring:light-dark(oklch(.62 0 0),oklch(.556 0 0));--status-online:light-dark(oklch(.45 .14 152),oklch(.74 .16 152));--status-down:light-dark(oklch(.46 .2 25),oklch(.7 .2 24))}*{box-sizing:border-box}html,body{height:100%;overflow:hidden}body{margin:0;background:var(--muted);color:var(--foreground)}button,a{font:inherit}.fleet-shell{display:flex;height:100dvh;width:100%;max-width:640px;margin:0 auto;flex-direction:column;overflow:hidden;background:var(--background);box-shadow:0 0 0 1px var(--border),0 18px 70px light-dark(#00000012,#00000070)}.fleet-header{z-index:20;display:flex;min-height:calc(3.75rem + env(safe-area-inset-top));flex:none;align-items:flex-end;gap:.25rem;border-bottom:1px solid var(--border);background:var(--muted);padding:.5rem .5rem .5rem .75rem;padding-top:calc(env(safe-area-inset-top) + .5rem)}.fleet-mark{display:grid;width:2.75rem;height:2.75rem;flex:none;place-items:center;border-radius:calc(var(--radius) - 2px);color:var(--foreground);font-size:1rem;font-weight:900;text-decoration:none}.fleet-mark:hover{background:var(--accent)}.instance-strip{display:flex;min-width:0;flex:1;align-items:center;gap:.35rem;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none}.instance-strip::-webkit-scrollbar{display:none}.connecting{padding:0 .6rem;color:var(--muted-foreground);font-size:.8rem}.instance-tab{display:flex;height:2.5rem;max-width:11rem;flex:none;align-items:center;gap:.45rem;border:1px solid transparent;border-radius:999px;background:transparent;padding:0 .8rem;color:var(--muted-foreground);cursor:pointer}.instance-tab:hover{background:color-mix(in oklch,var(--accent) 60%,transparent);color:var(--foreground)}.instance-tab[aria-selected="true"]{border-color:var(--border);background:var(--accent);color:var(--foreground)}.instance-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;font-weight:700}.status-dot{width:.5rem;height:.5rem;flex:none;border-radius:999px;background:var(--status-down);box-shadow:0 0 0 2px color-mix(in oklch,var(--status-down) 18%,transparent)}.instance-tab[data-health="online"] .status-dot{background:var(--status-online);box-shadow:0 0 0 2px color-mix(in oklch,var(--status-online) 18%,transparent)}.header-action{display:grid;width:2.75rem;height:2.75rem;flex:none;place-items:center;border:0;border-radius:calc(var(--radius) - 2px);background:transparent;color:var(--muted-foreground);font-size:1.25rem;line-height:1;text-decoration:none;cursor:pointer}.header-action:hover{background:var(--accent);color:var(--foreground)}.logout-form{display:block;margin:0}.frame-stage{position:relative;display:flex;min-height:0;flex:1;overflow:hidden;background:var(--background)}.node-frame{width:100%;height:100%;border:0;background:var(--background)}.frame-loading{position:absolute;inset:0;z-index:4;display:grid;place-content:center;justify-items:center;gap:.8rem;background:var(--background);color:var(--muted-foreground);font-size:.8rem}.loading-mark,.empty-mark{display:grid;width:3rem;height:3rem;place-items:center;border:1px solid var(--border);border-radius:1rem;background:var(--card);color:var(--foreground);font-size:1.1rem;font-weight:900;animation:pulse 1.35s ease-in-out infinite}.node-notice{position:absolute;z-index:6;top:.75rem;right:.75rem;left:.75rem;display:flex;min-height:2.75rem;align-items:center;gap:.55rem;border:1px solid color-mix(in oklch,var(--status-down) 35%,var(--border));border-radius:var(--radius);background:color-mix(in oklch,var(--card) 94%,transparent);padding:.45rem .55rem;box-shadow:0 12px 30px light-dark(#00000014,#00000070);backdrop-filter:blur(12px)}.node-notice .status-dot{width:.55rem;height:.55rem}.notice-text{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted-foreground);font-size:.75rem}.notice-action,.primary-action{min-height:2rem;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background:var(--accent);padding:0 .75rem;color:var(--foreground);font-weight:700;cursor:pointer}.empty-state{margin:auto;display:grid;max-width:20rem;justify-items:center;padding:2rem;text-align:center}.empty-state .empty-mark{animation:none}.empty-state h1{margin:1rem 0 .4rem;font-size:1.15rem}.empty-state p{margin:0 0 1.25rem;color:var(--muted-foreground);font-size:.85rem;line-height:1.5}.primary-action{min-height:2.75rem;padding:0 1rem}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}[hidden]{display:none!important}:focus-visible{outline:2px solid var(--ring);outline-offset:2px}@keyframes pulse{50%{opacity:.45;transform:scale(.96)}}@media(max-width:640px){.fleet-shell{box-shadow:none}.fleet-header{padding-right:.25rem;padding-left:.25rem}.fleet-mark{width:2.5rem}.header-action{width:2.5rem}.instance-tab{max-width:8.5rem;padding:0 .65rem}}@media(prefers-reduced-motion:reduce){.loading-mark{animation:none}}
`;

export const FLEET_JS = `
const STORAGE_KEY='herdr-web-remote:selected-instance';
const instances=document.querySelector('#instances');
const frame=document.querySelector('#node-frame');
const loading=document.querySelector('#frame-loading');
const notice=document.querySelector('#node-notice');
const noticeText=document.querySelector('#notice-text');
const openNode=document.querySelector('#open-node');
const empty=document.querySelector('#empty-state');
const emptyTitle=document.querySelector('#empty-title');
const emptyCopy=document.querySelector('#empty-copy');
const fleetStatus=document.querySelector('#fleet-status');
let nodes=[];
let selectedId=null;
let currentOrigin=null;
let refreshing=false;

const healthLabel=(health)=>({online:'Online','herdr-down':'Herdr unavailable','bridge-down':'Collie unavailable','transport-down':'Transport unavailable'}[health]||'Unavailable');
const remembered=()=>{try{return localStorage.getItem(STORAGE_KEY)}catch{return null}};
const remember=(id)=>{try{localStorage.setItem(STORAGE_KEY,id)}catch{}};
const requested=()=>new URL(location.href).searchParams.get('instance');
const nodeOrigin=(node)=>new URL('https://'+node.publicHost+'/').origin;
const selectedNode=()=>nodes.find((node)=>node.id===selectedId)||null;
const announce=(message)=>{fleetStatus.textContent=message};

function updateUrl(id){
 const url=new URL(location.href);
 if(url.searchParams.get('instance')===id)return;
 url.searchParams.set('instance',id);
 history.replaceState(null,'',url);
}

function chooseNode(){
 const candidates=[selectedId,requested(),remembered()];
 for(const id of candidates){const match=nodes.find((node)=>node.id===id);if(match)return match}
 return nodes.find((node)=>node.health==='online')||nodes[0]||null;
}

function renderTabs(focusSelected=false){
 instances.replaceChildren();
 for(const node of nodes){
   const button=document.createElement('button');
   button.type='button';button.className='instance-tab';button.setAttribute('role','tab');button.dataset.instance=node.id;button.dataset.health=node.health;
   button.setAttribute('aria-selected',String(node.id===selectedId));
   button.setAttribute('aria-label',node.name+' · '+healthLabel(node.health));
   const dot=document.createElement('span');dot.className='status-dot';dot.setAttribute('aria-hidden','true');
   const label=document.createElement('span');label.className='instance-name';label.textContent=node.name;
   button.append(dot,label);
   button.addEventListener('click',()=>selectNode(node.id,{focusTab:false}));
   instances.append(button);
 }
 const active=instances.querySelector('[aria-selected="true"]');
 if(active){active.scrollIntoView({block:'nearest',inline:'nearest'});if(focusSelected)active.focus()}
}

function updateHealth(node){
 const healthy=node.health==='online';
 notice.hidden=healthy;
 if(!healthy){
   const detail=node.message?' · '+node.message:'';
   noticeText.textContent=node.name+' · '+healthLabel(node.health)+detail;
 }
}

function loadSelected(force=false){
 const node=selectedNode();if(!node)return;
 const origin=nodeOrigin(node);
 openNode.href=origin+'/';openNode.hidden=false;
 frame.title='Collie · '+node.name;
 frame.hidden=false;empty.hidden=true;updateHealth(node);
 if(force||currentOrigin!==origin){
   currentOrigin=origin;loading.hidden=false;frame.src=origin+'/';
 }
}

function selectNode(id,options={}){
 const node=nodes.find((candidate)=>candidate.id===id);if(!node)return;
 const changed=selectedId!==id;selectedId=id;remember(id);updateUrl(id);
 renderTabs(Boolean(options.focusTab));
 loadSelected(Boolean(options.forceFrame)||changed);
 announce('Selected '+node.name+'. '+healthLabel(node.health)+'.');
}

function showEmpty(title,copy){
 selectedId=null;currentOrigin=null;instances.replaceChildren();openNode.hidden=true;notice.hidden=true;loading.hidden=true;frame.hidden=true;frame.removeAttribute('src');
 emptyTitle.textContent=title;emptyCopy.textContent=copy;empty.hidden=false;announce(title+'. '+copy);
}

function renderInventory(data){
 nodes=Array.isArray(data.nodes)?data.nodes.filter((node)=>node&&typeof node.id==='string'&&typeof node.name==='string'&&typeof node.publicHost==='string'):[];
 if(!nodes.length){showEmpty('No instances','No enabled Herdr instances are configured.');return}
 const choice=chooseNode();
 if(!choice){showEmpty('No instances','No enabled Herdr instances are configured.');return}
 if(choice.id!==selectedId)selectNode(choice.id);
 else{renderTabs();loadSelected(false)}
}

async function refresh(){
 if(refreshing)return;refreshing=true;
 try{
   const response=await fetch('/api/fleet',{headers:{accept:'application/json'},cache:'no-store'});
   if(response.status===401){location.assign('/auth/login?next='+encodeURIComponent(location.href));return}
   if(!response.ok)throw new Error('HTTP '+response.status);
   renderInventory(await response.json());
 }catch(error){
   const message=error instanceof Error?error.message:String(error);
   if(!nodes.length)showEmpty('Fleet unavailable','Could not load instance inventory. '+message);
   announce('Fleet refresh failed. '+message);
 }finally{refreshing=false}
}

instances.addEventListener('keydown',(event)=>{
 if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
 const index=nodes.findIndex((node)=>node.id===selectedId);if(index<0)return;
 event.preventDefault();const delta=event.key==='ArrowRight'?1:-1;const next=nodes[(index+delta+nodes.length)%nodes.length];if(next)selectNode(next.id,{focusTab:true});
});
frame.addEventListener('load',()=>{loading.hidden=true;const node=selectedNode();if(node)announce(node.name+' Collie loaded.')});
document.querySelector('#retry-frame').addEventListener('click',()=>loadSelected(true));
document.querySelector('#retry-inventory').addEventListener('click',()=>refresh());
addEventListener('popstate',()=>{const id=requested();if(nodes.some((node)=>node.id===id))selectNode(id)});
refresh();setInterval(refresh,5000);
`;
