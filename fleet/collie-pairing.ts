import { PairingStore, filePairingIo, generateToken, sha256Hex, type PairingIo } from "../bridge/pairing.ts";

/**
 * THE GATEWAY IS COLLIE'S ONE PAIRED DEVICE.
 *
 * Since Collie 1.18 pairing is always on (ADR 0086): every `/api/*` route but health and pair needs a
 * paired device's bearer token, reads included, and Collie's own host credential is refused on any
 * request a proxy forwarded. Every request the Gateway sends is such a request, and the browser
 * behind it authenticated to the Gateway, not to Collie. So the Gateway enrols itself, through
 * Collie's own registry and Collie's own module, before the Collie child starts — the same place
 * the crew trust state is validated, so nothing here races a write of Collie's.
 *
 * The token is minted anew on every start and never written anywhere: Collie stores only its hash,
 * as it stores every device's, the supervisor hands the token to the Gateway alone, and a stop
 * revokes it again. Nothing about it is the operator's to do.
 */

/**
 * How the supervisor hands the token to the Gateway child: in that child's environment and no other's.
 * The Gateway reads it once at start and deletes it from its own environment, so nothing it spawns
 * inherits it.
 */
export const GATEWAY_TOKEN_ENV = "HERDR_FLEET_COLLIE_TOKEN";

/** The label the Gateway's device carries in Collie's registry, and the revoke handle for it. */
export const GATEWAY_DEVICE_LABEL = "fleet-gateway";

/**
 * Enrol a fresh Gateway device in Collie's registry under `stateDir`, and answer its token.
 *
 * Any device already holding the Gateway's label is revoked first, so the token a previous start
 * held authenticates as nobody. Collie's `adopt` writes nothing and names the colliding labels when
 * the label is still taken, which is refused here rather than worked around. An unreadable registry
 * throws Collie's own `RegistryUnreadableError`, so the generation does not start on a registry
 * whose devices are not known.
 */
export async function enrolGatewayDevice(
  stateDir: string,
  deps: { io?: PairingIo; now?: () => number; token?: () => string } = {},
): Promise<string> {
  const now = deps.now ?? Date.now;
  const store = new PairingStore(deps.io ?? filePairingIo(stateDir), now);
  await store.revoke(GATEWAY_DEVICE_LABEL);
  const token = (deps.token ?? generateToken)();
  const conflicts = await store.adopt([{ label: GATEWAY_DEVICE_LABEL, tokenHash: sha256Hex(token), createdAt: now() }]);
  if (conflicts.length > 0) {
    throw new Error(`Collie's pairing registry still holds a device named ${GATEWAY_DEVICE_LABEL}`);
  }
  return token;
}

/** Drop the Gateway's device again. False when there was none. */
export async function revokeGatewayDevice(stateDir: string, deps: { io?: PairingIo } = {}): Promise<boolean> {
  return new PairingStore(deps.io ?? filePairingIo(stateDir)).revoke(GATEWAY_DEVICE_LABEL);
}
