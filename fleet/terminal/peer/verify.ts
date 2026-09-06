/**
 * Is the executable this member is configured to start the one the configuration named?
 *
 * A digest rather than a version string, and checked immediately before each start rather than once
 * at boot: the thing being identified is about to be given a terminal on this machine, and a file
 * that was replaced an hour after the service started is exactly the case a boot-time check misses.
 */

export async function verifyExecutableDigest(path: string, expected: string): Promise<boolean> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) return false;
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(new Uint8Array(await file.arrayBuffer()));
    return hasher.digest("hex") === expected;
  } catch {
    // Unreadable is not verified. Nothing is started on a maybe.
    return false;
  }
}
