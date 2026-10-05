## External peer transport

An enrolled schema-2 peer may use network projections maintained by its operator. Replace the whole transport table with:

```toml
[transport]
mode = "external"
peer_bind_host = "127.0.0.1"
peer_bind_port = 18902
```

The endpoint names the operator's peer-side loopback projection of the lead. It must differ from the peer's Collie and terminal binds. This variant accepts no SSH host, account, key, known-hosts, retry or command fields. Existing `ssh-reverse` files remain unchanged.

The operator supplies both directions, including the lead-side projections of Collie and any declared terminal service. The existing optional terminal table remains valid; its lead-side endpoint is a descriptor in external mode, and Fleet does not publish it. Native crew certificates and secrets remain end-to-end, with no new enrollment or trust editing.

Install a supporting stable release before selecting this mode. Restart only the Fleet plugin through its ordinary Herdr action. The peer then supervises Collie and its optional terminal service, with no SSH child. Its status includes `transport=external`. A running supervisor means the local Fleet services are ready; it does not certify operator-owned network reachability. Verify connectivity through the lead's authenticated crew census.

An unavailable external path does not prevent local service startup and never causes Fleet to create a tunnel or restart Collie. Restore the external projections through their own owner. To roll back, release conflicting operator projections, restore the prior stable release/configuration and restart only Fleet; preserve crew state and the multiplexer.
