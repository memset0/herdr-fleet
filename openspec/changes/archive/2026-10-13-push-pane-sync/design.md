## Context

See proposal.md. Collie v1.20.1 and Fleet’s authenticated lead remain the baseline. Shared-view writes are already serialized; inventory, state reads and presence currently share a polling cycle.

## Goals / Non-Goals

Remove polling delay from accepted choices while keeping fresh identity resolution, native navigation and explicit viewer participation. No new dependency or peer change.

## Decisions

Use a fetch-based SSE reader in an owned client and a bounded owned Gateway stream. One-way notifications fit SSE; POST remains the existing mutation channel, so a WebSocket command protocol is unnecessary. The store emits full snapshots only after successful writes and assigns an increasing transport sequence to every successful mutation, including layout changes. HTTP and SSE responses share this order; late responses cannot roll back a newer stream snapshot.

Subscribe before reading the initial snapshot to avoid a connect/write gap. Disconnect slow readers instead of buffering without bound. Abort and cancellation unsubscribe; periodic keepalives recheck the authenticated session and preserve proxy liveness. On reconnect deliver current state rather than replaying a history.

Open the stream independently of inventory refresh and renew presence on its own five-second timer. Hide/leave/cleanup closes the stream and withdraws presence; visibility return reconnects before allowing local publication. Inventory continues to authorize fresh unique identities and never decides transport timing.

## Risks / Trade-offs

Proxy buffering can mask push → send no-buffer/no-store headers and verify the live stream. HTTP/SSE races can reorder replies → generation, revision and transport-sequence checks plus regression tests. Slow consumers → bounded queues and reconnect to the latest snapshot.

## Migration Plan

Lead-only patch with frontend rebuild and Gateway restart. Preserve main and existing sessions/slots. Verify initial authenticated SSE frames, push latency under slow inventory, reconnect ordering and cleanup. Roll back to the previous release if needed.

## Verification and Release Assessment

32 focused backend tests, 742 Fleet tests, 18 frontend tests and nine browser scenarios passed. A real local HTTP SSE fixture verified selection delivery below 1.2 seconds while panel inventory was delayed four seconds; disconnect/reconnect, receiver counts, no echoes and existing touch/order flows passed. Latest client recovery and stream scenarios were rechecked. Release axis is PATCH, 3.16.2 → 3.16.3: lead frontend rebuild and Gateway restart only. Verify authenticated public-origin SSE frames and an ordered no-op layout update without changing Pane selection or slot contents after deployment.
