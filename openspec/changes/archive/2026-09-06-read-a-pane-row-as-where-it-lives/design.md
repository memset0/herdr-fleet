## Context

The switcher's Pane row has been reshaped twice in as many days: first to say which fact a query
matched, then to stop that slot changing meaning by showing the whole address. Both were about the
right-hand slot. This one is about which half of the row leads.

## Goals / Non-Goals

**Goals** — a row that is scanned by where it lives; one name per machine across the application; a
mark that does not move text.

**Non-Goals** — the roster's order, activation, command mode, and the tint the rails give each host.

## Decisions

### The host is resolved where the roster is built, not where it is drawn

`hostName(servers, id)` is Collie's own, and the shell already calls it for the sidebar. Calling it
again in the command bar would mean threading `servers` into a component whose whole input is a
roster — and would leave two places that could come to disagree, which is exactly the bug being
fixed. So the roster entry carries the resolved name, set by the same code that already maps Collie's
rows into roster entries.

The entry keeps the raw id as well: identity and opening a Pane are the id's job — `rosterEntryKey`
is built from it — and only the display and the search use the name.

### The tag is present only on a pack

`isMultiHost` is the predicate the rails already use to decide whether a host is worth tinting. The
same answer decides whether a host is worth naming on a row. On a solo install the field is simply
absent, which is the same shape as a Pane with no Tab name, so nothing downstream needs a second
notion of "empty".

### Search follows what is displayed

An operator types what they can see. The host field is therefore matched on the resolved name, not on
the id — searching `vultr` finds the lead's Panes, and searching `lead` no longer does, because that
string is not on screen anywhere.

### The mark is ink and a rule, not weight

Weight was the wrong tool: making a subset of characters semibold changes their advance width, so the
text around a match shifts as the query is typed — the row moves under the eyes that are reading it.
An underline occupies no horizontal space and the foreground token is already the highest-contrast
ink in both themes, so "white in the dark, near-black in the light" is what it resolves to without a
second rule.

### The offset arithmetic is deleted rather than maintained

Joining the address into one string forced a match's positions to be shifted out of their own field's
coordinates, which was the most breakable part of the previous shape. Each field is now its own
element and carries its own positions, so there is nothing to shift and nothing to get wrong.

## Risks / Trade-offs

- **The Pane's own name is now the thing that truncates first.** That is the intent — it is the least
  distinguishing part — but an operator who names Panes by hand will notice.
- **Four elements in a row that had two.** The widths are declared so that the left pair takes the
  slack and the right pair holds its size, which is the arrangement §2 wants; the tag is the only
  fixed-width thing and it is short by construction.

## Migration Plan

None. Display only, and the underlying roster gains one derived field.

## Open Questions

None.
