## Context

Native Chat already uses its own 12–20px font-size setting. See proposal.md for the missing spacing control.

## Goals / Non-Goals

Reuse native Chat sizing and Display. Keep typography state browser-local and avoid upstream business logic.

## Decisions

An owned provider stores a bounded letter-spacing value under a dedicated browser key, exposes its CSS variable to the owned shell and renders an owned stepper only when that provider exists. Display's existing Chat branch imports and mounts that component after Text size; bare Collie renders nothing extra. The owned shell applies the variable only to the existing session-stream data slot through a scoped CSS selector. SessionStream needs no edit; mirror, terminal, composer and rails do not consume the variable. Default normal preserves native appearance; reset is explicit. Register the new owned files and extend the already-declared Display attribution. A new stream prop/style port was rejected because its existing data slot already supplies the needed boundary.

## Risks / Trade-offs

Negative spacing can reduce legibility → bound it to -0.08em and keep an immediate reset. Storage may be unavailable → retain an in-memory choice and avoid failing rendering. Multiple browser tabs may update the preference → listen to storage changes.

## Migration Plan

Frontend-only PATCH on the lead after focused tests and browser verification. No peer or data migration.
