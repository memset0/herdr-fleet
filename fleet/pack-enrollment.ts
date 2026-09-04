import {
  acceptEnrollment,
  createTrustStore,
  identityMinter,
  mintInvite,
  parseEnrollResponse,
  PACK_PROTOCOL_VERSION,
  selfIdentity,
  type EnrollRequest,
  type EnrollResponse,
  type IdentityMinter,
  type MintedInvite,
} from "../bridge/pack/enrollment.ts";
import { PACK_ENROLL_PATH } from "../bridge/pack/router.ts";
import { TrustStore, type TrustStoreData } from "../bridge/pack/trust-store.ts";
import type { JsonValue } from "../bridge/json.ts";

// Membership changes, driven through Collie's OWN transitions.
//
// WHY THIS EXISTS RATHER THAN A CALL TO `collie pack …`. Collie's CLI resolves an upstream plugin id
// from a constant (`cli/context.ts`) and picks a host supervision tier by probing for a service
// manager (`cli/lifecycle.ts`). Run against a Fleet deployment it therefore writes a foreign
// configuration directory and registers a service unit — and a Fleet peer runs rootless on hosts
// that have no service manager at all, so that path is not merely unwanted, it cannot work there.
//
// The transitions underneath that CLI carry none of those assumptions: they are pure functions over
// trust-store data, and `TrustStore.update()` is their one persistence seam. This module applies
// them and nothing else. It resolves no plugin identity, probes no service manager, and starts,
// stops or restarts no process — a change that must reach a running runtime is applied by restarting
// the Herdr plugin, which is the caller's act, not this module's.

/** The lead's reply to a posted enrolment request, before it is parsed. */
export type EnrollTransport = (url: string, request: EnrollRequest) => Promise<JsonValue | undefined>;

/**
 * POST the request and hand back the parsed JSON body, or `undefined` when the lead answered with
 * anything other than a JSON success. The lead's refusal reason is deliberately not surfaced: a
 * refused invite and a malformed body are the same instruction to the operator — mint a fresh one —
 * and the body of a refusal is one of the few places a token could be echoed back.
 */
const httpTransport: EnrollTransport = async (url, request) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) return undefined;
  try {
    // SAFETY: the value is handed straight to Collie's own `parseEnrollResponse`, which narrows every
    // field before any of it is persisted; nothing here reads it as a domain value.
    return (await response.json()) as JsonValue;
  } catch {
    return undefined;
  }
};

/**
 * The store this machine will act on, creating it on the operator's first act.
 *
 * Identity is minted here and only here, which is the same single path upstream uses: a runtime that
 * never enrols still writes no key, no certificate and no store, so the zero-tax contract holds.
 */
async function ensureStore(
  store: TrustStore,
  commonName: string,
  now: number,
  mint: IdentityMinter,
): Promise<TrustStoreData> {
  const existing = await store.load();
  if (existing !== null) return existing;
  return createTrustStore(selfIdentity(commonName, await mint(), now));
}

export interface MintOptions {
  readonly collieStateDir: string;
  /** The member id this machine takes when it has no identity yet. */
  readonly selfId: string;
  readonly label?: string | null;
  readonly packName?: string;
  readonly now?: number;
  readonly identity?: IdentityMinter;
}

/**
 * Mint one single-use, short-lived invite on a lead.
 *
 * The token comes back in the clear and is the caller's to show exactly once; only its hash is
 * persisted. Nothing is restarted: the running lead read its store at boot, so the invite becomes
 * answerable when the caller restarts the plugin, and the caller is told so rather than surprised.
 */
export async function mintPeerInvite(options: MintOptions): Promise<MintedInvite> {
  const store = new TrustStore(options.collieStateDir);
  const now = options.now ?? Date.now();
  const mint = options.identity ?? identityMinter({ commonName: options.selfId });
  const data = await ensureStore(store, options.selfId, now, mint);
  const minted = await store.update((current) =>
    mintInvite(current ?? data, {
      now,
      label: options.label ?? null,
      packName: options.packName,
    }),
  );
  if (minted === null) throw new Error("the invite was not persisted");
  return minted;
}

export interface JoinOptions {
  readonly collieStateDir: string;
  /** The member id this machine takes when it has no identity yet; the lead may mint another. */
  readonly selfId: string;
  /** The lead as this peer reaches it — its own loopback projection of the lead's Collie. */
  readonly leadOrigin: string;
  /** The address the lead will dial this peer at, from the lead's point of view. */
  readonly address: string;
  readonly token: string;
  readonly label?: string | null;
  readonly now?: number;
  readonly identity?: IdentityMinter;
  readonly transport?: EnrollTransport;
}

/**
 * Spend an invite on a peer and persist what the lead hands back.
 *
 * Nothing is written until a response has parsed: a refused invite or an unreachable lead leaves this
 * machine exactly as it was. The lead's own store is the other half of that rule — it spends the
 * invite either way, which is Collie's deliberate design and not something this side can soften.
 */
export async function joinPack(options: JoinOptions): Promise<EnrollResponse> {
  const store = new TrustStore(options.collieStateDir);
  const now = options.now ?? Date.now();
  const mint = options.identity ?? identityMinter({ commonName: options.selfId });
  const data = await ensureStore(store, options.selfId, now, mint);
  const request: EnrollRequest = {
    protocol: PACK_PROTOCOL_VERSION,
    token: options.token,
    fingerprint: data.self.fingerprint,
    certPem: data.self.certPem,
    address: options.address,
    label: options.label ?? null,
  };
  const transport = options.transport ?? httpTransport;
  const url = new URL(PACK_ENROLL_PATH, options.leadOrigin).toString();
  let body: JsonValue | undefined;
  try {
    body = await transport(url, request);
  } catch {
    throw new Error("the lead could not be reached through the configured projection");
  }
  const response = parseEnrollResponse(body);
  if (response === null) {
    throw new Error("the lead refused the invite or answered with an unusable enrolment response");
  }
  const accepted = await store.update((current) =>
    acceptEnrollment(current ?? data, response, options.leadOrigin, now),
  );
  if (accepted === null) throw new Error("the enrolment was not persisted");
  return response;
}
