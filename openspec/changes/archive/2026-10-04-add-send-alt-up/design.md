## Context

See proposal.md. The key contract already accepts alt+Up; the command system keeps fixed sends as constant registration closures.

## Goals / Non-Goals

Keep the action within the existing Pane write guards and the closed invocation grammar. Introduce no new transport, control, binding default, or translation vocabulary.

## Decisions

Add one catalog row and one constant closure in the existing upstream-owned agent-chat.tsx port. A separate writer would duplicate authorisation and risk appending Enter; the existing sendFixedKeys path preserves one request and no retry. The invasive path is already declared by native-manual-pane-fit-port in FORK.toml; update its reason and verification list for this chord. Command names remain English by the existing catalog contract.

## Risks / Trade-offs

[Wrong modifier spelling or accidental submit] → Pin the adapter's exact alt+Up array and exercise existing command selection and binding configuration.

## Migration Plan

PATCH release: rebuild and deploy the lead browser bundle only. Existing peers already accept the chord. Roll back the browser bundle to the prior release if needed. No state migration.
