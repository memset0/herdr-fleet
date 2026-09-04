## Context

See `proposal.md` — Why. Three facts about the current tree shape every decision below.

- **There is no iframe.** The command system this reapplies was split across a page and a
  cross-origin child. Here everything runs in one React application, so the entire parent/child
  protocol — Window and Origin checks, a configuration epoch, request ids, a bounded
  handler-registration race — has nothing to protect and is not reapplied.
- **`fleet/ui/**` imports downward only.** The existing owned modules import from `bridge/` and never
  from `web/src/`, which is what lets the root suite run them with no browser and no React. Every new
  pure module keeps that direction.
- **Two writers will exist for the settings document.** The browser writes it from the Settings page,
  and the installation's own management scope writes it on disk. Neither may silently overwrite the
  other.

## Goals / Non-Goals

Goals beyond the proposal's scope statement:

- Keep every rule that can be expressed without a DOM in a pure module the root suite covers:
  the catalog, the binding grammar, the recognizer's state machine, the roster, the fuzzy matcher,
  and the document's validation.
- Keep the invasive surface to ports this repository has already opened, so this change adds as few
  new upstream-owned paths as it can.

Non-goals beyond the proposal's:

- No change to how the recognizer behaves on a touch layout beyond the availability rules the specs
  already state; this change does not design a mobile keyboard story.
- No caching or prefetching of the settings document beyond the modification-time check.

## Decisions

### Focus arbitration is a capture-phase listener, not a change to the composer

Direct-typing mode intercepts `Escape`, `Tab` and the arrows in the composer textarea's own
`onKeyDown` prop — the bubble phase, on that element. A listener registered on the document in the
**capture** phase therefore runs first by construction, with no cooperation from the composer at all.

The recognizer registers exactly ONE such listener, always present, and the state machine behind it
decides. Unarmed, it answers only to a complete direct chord, which the specs require to work in every
focus context anyway; armed, it takes the next key outright.

A second listener for direct chords was drafted and dropped. The argument for splitting them was that
one always-capturing listener puts every keystroke through Fleet's matcher — but so does a
direct-chord listener, so the split bought nothing and added a second place for the two to disagree
about who consumed a key. What actually bounds the risk is that the machine returns "prevent" only for
a complete binding, an accepted prefix, or the `Escape` that cancels one; every other key is observed
and passed on untouched.

The alternative genuinely rejected is giving the composer a "suspended" prop that Fleet raises while a
prefix is armed — a Fleet-shaped prop on an upstream-owned component, for a fact the DOM already
orders correctly.

### The roster takes sections in, rather than calling triage itself

`derivePaneRoster()` accepts the already-bucketed sections plus the shell Panes and the favorite
predicate, and returns both the sectioned view and its flattening. It does not import Collie's triage.

That keeps `fleet/ui/` importing downward only, keeps the module runnable in the root suite, and
leaves bucketing exactly where Collie owns it. The two alternatives both cost more: importing triage
into `fleet/ui/` reverses the dependency and drags i18n into a pure module, and re-implementing
bucketing creates a second definition of "which section is this Pane in" that will drift.

The rail keeps rendering only the triage sections. The `shell` section exists in the roster for the
command bar, which is why the Agent surface's existing "no shell rows" rule is untouched rather than
modified.

### The settings document rides Fleet's own Gateway, and lives with Fleet's own configuration

The transport is a pair of routes on Fleet's Gateway, which already owns an authenticated surface of
its own. Nothing under `bridge/` changes, and Collie's config endpoint keeps answering only for
Collie's own settings.

The file sits in the same directory as Fleet's private configuration rather than in the state
directory, because bindings are an operator's choice rather than derived state — a wiped state
directory must not silently return the operator to stock defaults.

It is JSON rather than TOML. Upstream's split is consistent: the files a person hand-authors are TOML
and the files the program rewrites are JSON, and this one is rewritten by a text area whose errors
must be reportable at a position.

Alternatives rejected: extending Collie's `/api/config` (invades `bridge/` for a setting that is not
Collie's); a section inside the private configuration file (a program rewriting a hand-authored,
strictly-validated TOML would destroy its comments); and browser-local storage (it cannot be managed
from the installation's own scope, and would not survive a browser change).

### Reads hold the last good document; writes are atomic and version-guarded

Reading follows the posture Collie already uses for the operator's own files: check the modification
time, re-read only when it moved, and on a parse or validation failure keep serving the last good
document while warning once per change of the file. A half-saved file must never take the Settings
page down.

Writing follows the posture Fleet already uses for its session state: write a temporary file and
rename it into place, so a reader never observes a partial document. The client sends back the
version it read, and a mismatch is refused with the current document returned — the cheapest
resolution of the two-writer problem, and the only one that cannot lose an edit made on disk.

### One overlay with two modes, under a new name

Collie already owns `command-palette.tsx`: the Agent slash-command bottom sheet. The new surface is a
separate component with its own name, so neither is renamed and no reader has to guess which is
meant.

One overlay carries both modes because they are the same interaction — type, filter, move, activate —
and because the `/` sigil matching the harness's own convention makes the mode legible without a
second surface to learn.

### The panel borrows the quick-input GEOMETRY, and none of the paint

The ask is that the command bar feel like the editor quick-input every operator already knows. What
carries that feeling is geometry and information layout, not colour: a top-anchored centred panel at
a bounded width, an input above a bounded scrolling result region, dense single-line rows, the
matched characters marked, and the bindings right-aligned at the trailing edge.

All of that is adopted. None of the editor's palette is. The ground, rules, type and row height come
from `DESIGN.md`'s tokens, so it reads as part of this application rather than as a widget pasted
into it.

§1 says to look in `components/ui/` before building anything, and the answer there is that the only
modal primitive is the bottom sheet — the one presentation this panel must not be. A top-anchored
quick-input primitive is not promoted into `components/ui/` either: that directory is Collie's, and a
fork-only primitive placed in it would be a wider boundary claim than the component it serves. It
stays a fork-owned component and reuses the tokens, which is the part of §1 that is actually about
consistency.

Two of the app's standing rules do real work here and are why the spec states the panel's size
behaviour explicitly. §2 — no state may move content — means the panel's outer size cannot change as
results filter, so the result region is bounded and scrolls internally rather than growing. §4 — a
raised panel is `--card` — settles what it stands on, and the boundary is drawn once from above.

The one presentation choice that is not the editor's is refusing the bottom sheet. Collie's own
palettes are sheets, and a second sheet holding a different catalog would be the same surface saying
two things.

### Acknowledgement reuses the existing floating status, not a new surface

`DESIGN.md` §11 fixes four acknowledgement channels and one question each, and a keyboard command
lands squarely in the third: there is no control the operator touched, so the outcome cannot be shown
at the point of action, which is exactly the case that channel exists for. Failures go there
unconditionally already.

So the acknowledgement publishes through `lib/status.ts` rather than introducing a fifth surface —
which also means the orbit round follows automatically under that section's "worth a notice, worth a
round" rule, with no second decision to make.

The rule it adds on top is one this system needs and the channel does not state: a command whose
whole effect is the navigation the operator just asked for publishes nothing, because the new route
is already the answer.

### No `Alt` defaults ship

Direct chords are best-effort: a browser or an extension may take one before page script sees it.
The prefix path has no such exposure, so it carries the defaults. The two chords that open the
command bar are the exception, because a discovery surface that can only be reached through a
sequence is not discoverable.

Every command the `Alt` family used to carry stays in the catalog, listed in the command bar with an
explicit "no binding", and bindable in one line of the settings document.

## Risks / Trade-offs

- **`Ctrl+P` prints if our handler does not run** (page not focused, a native dialog is up, an
  extension took it first) → the recognizer prevents the default synchronously in the key event, and
  the binding grammar's rejection list keeps operators away from the chords that cannot be taken at
  all. It remains a default an operator can remove in one line.
- **A preemption bug would swallow a keystroke the operator meant for a Pane** → preemption exists
  only while a prefix is pending, and every exit from that state — completion, timeout, `Escape`,
  focus-context loss, document hiding — releases it. The state machine is a pure module with the
  release paths covered directly.
- **The settings document has two writers** → the version guard refuses a stale write instead of
  merging, and the refusal returns the current document so the editor can show what changed.
- **Another change is active in this repository and touches the same rails.** Its delta is on
  different requirements of `fleet-native-navigation-sidebars`, and this change adds a requirement
  rather than modifying one, but both artifacts must be re-read before either is synced, and the rail
  component must be re-read immediately before it is edited.
- **Extracting the rail's order touches a component under active edit** → the extraction is a pure
  module plus one call site; the component's markup is not restructured by this change.

## Migration Plan

There is nothing to migrate. An installation with no settings document gets the shipped defaults,
which is the state every installation is in today. Rolling back is deleting the document, or
reverting the change; neither leaves anything behind that another version has to understand.

The `Alt` bindings an installation used before are not carried forward automatically, by design — an
installation that wants them declares them in its own document.

## FORK.toml boundary

New fork-owned modules and components are added to the existing owned entry. The upstream-owned paths
this change touches are already attributed by the manifest, and must ride those entries rather than
opening a second one for the same path:

| Upstream path | Port | Existing entry it rides |
| --- | --- | --- |
| `web/src/routes/settings.tsx` | The Fleet group's mount and its position at the head of the page | `native-navigation-sidebars-port` |
| `web/src/components/composer.tsx` | The direct-typing toggle exposed to the command adapter | `native-manual-pane-fit-port` |
| `web/src/components/agent-chat.tsx` | The Pane-scoped adapters the commands drive | `native-manual-pane-fit-port` |
| `web/src/lib/i18n/messages/*.ts` | The command bar's and settings group's labels | `native-agent-favorites-port` |

The Settings page's grouping is worth naming explicitly in the manifest's reason, because the page
carries a written decision that it is a flat stack of cards with no headings. This change introduces
the first grouped section, deliberately, to keep the fork's settings distinguishable from Collie's.

## Open Questions

- Whether the Agent rail should eventually render the roster's `shell` section. The roster already
  produces it; turning it on is a consumer-side decision that changes no interface here.
- Whether the binding text area is later replaced by a per-command editor. The document contract is
  the same either way, so the surface can change without changing the specs above.
