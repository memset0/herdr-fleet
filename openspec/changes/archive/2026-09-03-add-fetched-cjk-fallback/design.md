## Context

See proposal.md — Why. Two facts about the baseline shape the whole approach:

- Every stack is spelled in `index.css`, and Tailwind's `@theme inline` SUBSTITUTES `--font-mono`'s
  literal text into `.font-mono`. Re-pointing that custom property at runtime therefore changes
  nothing — the class already carries the literal — which is why the terminal font setting applies
  its family as an inline style rather than a property.
- The terminal families share one `TAIL` constant in JavaScript, and the app's faces are three CSS
  blocks plus a pre-paint class list.

## Goals / Non-Goals

**Goals:**

- One position in every stack, decided in one place per language.
- No stack built in JavaScript, and no family name or URL that did not come from a compiled catalog.

**Non-Goals:**

- Per-surface fallbacks, a second provider, or any offline packaging of font bytes.

## Decisions

### The fallback is a `var()` hole inside the literal stacks, not a re-pointed token

`var(--font-cjk)` is written INTO the stacks in `index.css` and into the terminal families' shared
tail. Because `@theme inline` substitutes the literal text, `.font-mono` compiles to a stack that
contains the `var()` — which is then resolved per element at use time, exactly as wanted. One hole
per stack, and the stacks stay where they are.

Alternative considered: build the stacks in JavaScript so the fallback can be spliced in. Rejected —
it makes the app a second source of truth for every stack `index.css` already states, which is the
drift the terminal font setting's own header warns about.

### "Off" is a family name, never an empty value

`var(--font-cjk)` resolving to nothing would place two commas together and invalidate the entire
declaration — every stack, at once, on the devices that chose no fallback. So the unset value is a
family name nothing will ever match; the browser steps over it, which is byte-for-byte the previous
behavior.

### One catalog, and the stored value is an id

The stored preference is an id or an explicit refusal, and the family name and URL are looked up in
a compiled list. A hand-edited record can therefore name a face the app does not have and get the
default — it cannot name a family, and it cannot name an origin.

### The Latin choice and the fallback are the same entry

Maple Mono NF CN already contains Maple Mono's Latin, so the picker entries resolve to the catalog's
family rather than to a second face. One family, one stylesheet, whichever way a device arrives at
it.

### The policy admits the origin for two directives and no more

`style-src` and `font-src` name the provider; `script-src` and `connect-src` are untouched. The
worst a compromised provider can do is change which glyphs are drawn. The app already sends
`referrer-policy: no-referrer`, so the deployment's own origin never reaches it.

## Risks / Trade-offs

- [A third party learns the IP addresses of the devices that render CJK] → It learns nothing else:
  no referrer, no cookies, no code execution, no channel back. A device that declines the fallback
  contacts it not at all.
- [The provider is a public service with no contract] → Its absence is the pre-existing behavior
  rather than a failure, and the preference survives an outage.
- [A device that turns the fallback off and picks the Latin face in the same session keeps the old
  stylesheet until reload] → The terminal picker's store is per-component state upstream, not a
  shared one; with the fallback at its default the case needs both halves to be unusual to reach.
