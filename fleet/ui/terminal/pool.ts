/**
 * The terminal instances this browser keeps across Pane switches.
 *
 * A terminal is expensive to build and, more to the point, expensive to *rebuild*: disposing one
 * throws away the screen it is holding, so walking back to a Pane you left a second ago would show a
 * blank rectangle until the Gateway re-established a session and something repainted it. Keeping a
 * few is what makes switching between two Panes feel like switching, rather than like opening.
 *
 * Bounded, and least-recently-used, for the reason every bound in this capability exists: each
 * retained instance holds a live connection at the other end of which is a real terminal on a real
 * machine, so "a few" has to be a number and not a habit.
 */

export interface InstancePoolOptions<T> {
  readonly max: number;
  /** Called exactly once per instance that leaves the pool, by eviction or by clearing. */
  readonly dispose: (value: T) => void;
}

export class InstancePool<T> {
  /** Insertion order is recency: a `get` re-inserts, so the first entry is the least recently used. */
  private readonly entries = new Map<string, T>();

  private readonly options: InstancePoolOptions<T>;

  constructor(options: InstancePoolOptions<T>) {
    if (options.max < 1) throw new Error("an instance pool must be allowed at least one instance");
    this.options = options;
  }

  size(): number {
    return this.entries.size;
  }

  keys(): readonly string[] {
    return Array.from(this.entries.keys());
  }

  get(key: string): T | undefined {
    const found = this.entries.get(key);
    if (found === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, found);
    return found;
  }

  /** Put an instance in, evicting the least recently used one first when the pool is full. */
  put(key: string, value: T): void {
    const previous = this.entries.get(key);
    if (previous !== undefined && previous !== value) {
      this.entries.delete(key);
      this.options.dispose(previous);
    }
    this.entries.set(key, value);
    while (this.entries.size > this.options.max) {
      const oldest = this.entries.keys().next();
      if (oldest.done === true) break;
      const evicted = this.entries.get(oldest.value);
      this.entries.delete(oldest.value);
      if (evicted !== undefined) this.options.dispose(evicted);
    }
  }

  /** Take one out without disposing it — used when the caller becomes its owner. */
  release(key: string): T | undefined {
    const found = this.entries.get(key);
    this.entries.delete(key);
    return found;
  }

  drop(key: string): void {
    const found = this.entries.get(key);
    if (found === undefined) return;
    this.entries.delete(key);
    this.options.dispose(found);
  }

  clear(): void {
    // Snapshotted: `dispose` may reach back into the pool, and a Map mutated while iterated skips.
    const held = Array.from(this.entries.values());
    this.entries.clear();
    for (const value of held) this.options.dispose(value);
  }
}
