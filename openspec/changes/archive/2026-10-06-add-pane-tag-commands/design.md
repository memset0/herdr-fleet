## Context

See proposal.md. The closed catalog drives both palette search and settings validation. The existing tag provider owns editor state above the command provider; the shell already resolves a host/session-aware pane for terminal bindings.

## Goals / Non-Goals

Reuse existing editors, shared dispatcher and native focus behavior. Do not add a keyboard listener, mutation command or upstream port.

## Decisions

- Add two default-unbound catalog entries. Reusing catalog resolution makes both settings validation and discovery consistent, rather than adding a separate shortcut implementation.
- Register adapters through a small owned tag-command component inside both providers. Pass the shell's existing scoped binding pane; adapters read current closures through the existing registration hook.
- Global management opens with no assignment target. Pane editing refuses a missing target through the standard command refusal instead of guessing from the roster.
- Treat opening the tag editor as self-evident, like existing dialog commands, so no redundant success toast competes with focus.
- All touched code is fork-owned; FORK.toml needs no new path or port.

## Risks / Trade-offs

Identical pane ids on different hosts/sessions → reuse the scoped lookup and test target changes. Overlay transitions could steal input focus → use the existing panel, dispatcher and focus tests.

## Migration Plan

Publish a lead-only PATCH after focused verification and archive this tag-specific change separately from the still-active Todoist change. No data or peer migration; previous release can be redeployed for rollback.
