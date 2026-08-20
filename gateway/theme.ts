/**
 * The small visual foundation shared by Gateway-owned documents.
 *
 * Keep these values aligned with the corresponding Collie tokens in `web/src/index.css`. The
 * Gateway cannot depend on Collie's protected, separately built stylesheet: login has to render
 * before authentication and Fleet has to remain available when a node bundle is unavailable.
 */
export const GATEWAY_THEME_CSS = `
:root {
  color-scheme: light dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  --radius: .65rem;
  --background: light-dark(oklch(.97 0 0), oklch(.145 0 0));
  --foreground: light-dark(oklch(.145 0 0), oklch(.985 0 0));
  --card: light-dark(oklch(1 0 0), oklch(.205 0 0));
  --card-foreground: light-dark(oklch(.145 0 0), oklch(.985 0 0));
  --primary: light-dark(oklch(.205 0 0), oklch(.922 0 0));
  --primary-foreground: light-dark(oklch(.985 0 0), oklch(.205 0 0));
  --muted: light-dark(oklch(.94 0 0), oklch(.269 0 0));
  --muted-foreground: light-dark(oklch(.48 0 0), oklch(.708 0 0));
  --accent: light-dark(oklch(.92 0 0), oklch(.269 0 0));
  --border: light-dark(oklch(.922 0 0), oklch(1 0 0 / 12%));
  --input: light-dark(oklch(.922 0 0), oklch(1 0 0 / 15%));
  --ring: light-dark(oklch(.62 0 0), oklch(.556 0 0));
  --destructive: light-dark(oklch(.577 .245 27.325), oklch(.704 .191 22.216));
}
* { box-sizing: border-box; }
button, a { font: inherit; }
button { color: inherit; }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
`;
