/**
 * Keep the native timeout subscribed for the whole operation. On Bun 1.3.14 a direct timeout
 * stops firing when its last abort listener is removed; sequential waits remove theirs between
 * phases. A linked signal retains that subscription without changing the budget or abort reason.
 */
export function sttTimeoutSignal(milliseconds: number): AbortSignal {
  return AbortSignal.any([AbortSignal.timeout(milliseconds)]);
}
