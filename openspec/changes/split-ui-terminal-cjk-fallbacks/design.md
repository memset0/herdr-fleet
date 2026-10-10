## Context

See proposal.md. The previous stage injected fetched faces into native primary-font choices. The owner now chooses role-specific fallback/only modes, no fallback when unset and a flat Fleet group below native navigation.

## Goals / Non-Goals

Restore native font settings while preserving explicit local choices. Keep fonts browser-local and the same provider/security policy. No peer or backend configuration change.

## Decisions

- Extend the owned bounded preference store with role and only-mode. Keep the terminal key for compatibility, add a UI key, default both to None. Migrate explicit old shared values to UI and existing fetched primary selections to per-role exclusive mode; persist migration once before native preferences change.
- Use independent UI and terminal fallback CSS properties. In normal mode native primary stacks lead; in only mode a closed-catalog stack precedes generic system fallback. Preserve Nerd Font symbols on terminal stacks.
- Restore native UI/terminal picker, design and pre-paint files to the exact baseline and remove their fork ports. Keep only narrow existing CSS and mirror-stack ports with role logic owned outside upstream files. Real terminal rendering resolves the same preferences before measuring cells and subscribes to changes.
- Reuse the existing switch and select controls in one owned card. Label the switches “Use only CJK font” to make the requested on/off meaning explicit. Use English-only font labels.
- Move the existing Fleet group mount below native settings navigation without altering native rows or introducing a submenu.

## Risks / Trade-offs

No fallback default changes previous implicit behavior → retain explicit stored selections and leave native/system fallback usable. Exclusive terminal fonts must preserve cell metrics → offer only monospace terminal faces and verify both rendering surfaces. Storage failure → retain safe in-memory choices. Native restoration → audit baseline diffs and update exact fork inventory.

## Migration Plan

Frontend PATCH, no operator action or peer rollout. Verify role independence, migration, modes, real fonts/mirror and flat settings order with focused tests/browser checks, then deploy and archive.
