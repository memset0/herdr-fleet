## Why

Every font stack on the exact Collie `v1.2.0` baseline is chosen on its Latin shapes, and almost no
monospace face draws CJK. The browser then falls through to whatever the device has, which on a
phone is a proportional face whose advance is not twice the Latin one — so a terminal mirror that is
a grid in English stops being one the moment a line has Chinese in it, and the chrome around it
changes voice mid-sentence. Nothing in the settings can fix that: the terminal picker and the
typeface picker each offer one face, and one face is what does not cover both scripts.

Shipping a CJK face is not the answer either. A full one is tens of megabytes, paid by every device
on every install and update, for glyphs most installs never paint.

## What Changes

- Every font stack — the app's, the terminal's, the content one, and each face the typeface setting
  offers — gains one position for a fallback face, after the operator's own faces and before the
  system's. Unset, that position names a family nothing matches, so the stacks behave exactly as
  they did.
- A new settings card chooses that face, or none. Its list is a closed catalog with one entry today,
  fetched from one provider that serves it in `unicode-range` chunks, so a browser downloads only
  the ranges it actually paints and caches each one. A device that renders no CJK downloads nothing
  beyond the stylesheet.
- The same face joins both existing pickers as a Latin choice, because the catalog entry already
  contains its Latin. Choosing it in either place and choosing it as the fallback resolve to one
  family and one download.
- The application's Content-Security-Policy admits that one origin for stylesheets and fonts, and
  for nothing else: `script-src` and `connect-src` are untouched, so the provider can serve no code
  and the app can open no channel to it.

Non-goals:

- Shipping any font bytes, adding a second provider, letting a stored value name an arbitrary family
  or URL, changing what the existing faces are, or touching the bundled Nerd Font subsets.

## Capabilities

### New Capabilities

- `fleet-webfonts`: the closed catalog, the fallback position in every stack, the device preference,
  and the exact boundary the fetched origin is admitted at.

### Modified Capabilities

None. Collie's typeface and terminal-font settings keep every requirement they carry; this adds a
face to their lists and a third card beneath them.

## Impact

- Fork-owned: a catalog and preference store under `fleet/ui/`, a DOM applier and a settings card
  under `web/src/`.
- Invasive ports, recorded in `FORK.toml`: the fallback position in `index.css` and in the terminal
  stacks' shared tail, one entry in each picker's closed list and in the pre-paint class list, the
  settings card's mount, the six dictionaries, and one origin in the CSP.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
