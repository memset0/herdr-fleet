## Why

The settings document does not reach the keyboard. An operator can write bindings into it, the
Gateway serves it, and the Settings page reads and validates and saves it — and the recognizer never
sees any of it. Every install runs the shipped defaults no matter what its document says.

The cause is one omission: the command provider takes the operator's bindings and prefix as inputs,
and the shell that mounts it passes neither, so the effective set is always `resolveBindings()` with
nothing to resolve against.

Worth stating plainly, because it is the more useful half of this: the tests did not catch it because
every one of them injects the overrides straight into the provider. They prove the mechanism and
never the wiring, so the one link that was missing was the one nothing exercised.

## What Changes

- The application loads its settings document once, at the top, and hands the operator's bindings and
  prefix to the command provider, so a document on disk is what the keyboard actually obeys.
- An install with no document, or one the Gateway does not serve, keeps every shipped default —
  which is what happens today and must keep happening.
- A test drives the whole path end to end: a served document changes what a key does. Not the
  mechanism with the bindings handed to it, but the wiring, which is what was broken.
- Saving in the Settings page takes effect without a reload.
- The panel both keyboard surfaces stand on stops stretching to the bottom of the viewport. It is a
  one-word fix found while testing this one — a flex row stretches its children, and only the command
  bar hid it by always declaring a height — and it is here rather than in a change of its own because
  a third change for one class would cost more to read than the class does.

### Non-goals

- Changing the document's format, its validation, its transport, or the catalog. All of those work;
  only the read into the recognizer is missing.
- Making the document per-browser or merging it with browser-local preferences.
- Polling the document. It is read when the application starts and after the operator saves it.

## Capabilities

### Modified Capabilities

- `fleet-settings`: the document's effect is stated as reaching the recognizer, not merely as being
  served and editable — the gap this change closes was possible because no requirement said so.

## Impact

- One fork-owned hook that loads and parses the document, consumed by the navigation shell, which
  passes two more props to a provider that already accepts them.
- No change to the Gateway, the document, the catalog, the recognizer, or any upstream-owned path.
