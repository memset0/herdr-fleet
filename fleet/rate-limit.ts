import type { FleetRateLimitConfig } from "./config.ts";

interface Budget {
  failures: number[];
  blockedUntil: number;
  blocks: number;
  touchedAt: number;
}

export interface LimitVerdict {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

const freshBudget = (): Budget => ({ failures: [], blockedUntil: 0, blocks: 0, touchedAt: 0 });

export class LoginRateLimiter {
  private readonly sources = new Map<string, Budget>();
  private readonly aggregate = freshBudget();

  constructor(private readonly config: FleetRateLimitConfig) {}

  get sourceCount(): number {
    return this.sources.size;
  }

  private compact(budget: Budget, windowMs: number, now: number): void {
    budget.failures = budget.failures.filter((failure) => now - failure <= windowMs);
    if (budget.blockedUntil <= now && budget.failures.length === 0) budget.blocks = 0;
  }

  allowed(source: string, now: number = Date.now()): LimitVerdict {
    this.compact(this.aggregate, this.config.aggregateWindowSeconds * 1_000, now);
    const local = this.sources.get(source);
    if (local !== undefined) {
      this.compact(local, this.config.windowSeconds * 1_000, now);
      if (local.failures.length === 0 && local.blockedUntil <= now) this.sources.delete(source);
    }
    const blockedUntil = Math.max(this.aggregate.blockedUntil, local?.blockedUntil ?? 0);
    return {
      allowed: blockedUntil <= now,
      retryAfterSeconds: blockedUntil <= now ? 0 : Math.max(1, Math.ceil((blockedUntil - now) / 1_000)),
    };
  }

  failure(source: string, now: number = Date.now()): void {
    this.failureFor(
      this.aggregate,
      now,
      this.config.aggregateMaxFailures,
      this.config.aggregateWindowSeconds * 1_000,
      this.config.aggregateBlockSeconds * 1_000,
    );
    let local = this.sources.get(source);
    if (local === undefined) {
      this.makeRoom(now);
      local = freshBudget();
      this.sources.set(source, local);
    }
    this.failureFor(
      local,
      now,
      this.config.maxFailures,
      this.config.windowSeconds * 1_000,
      this.config.blockSeconds * 1_000,
    );
  }

  success(source: string): void {
    this.sources.delete(source);
  }

  private failureFor(budget: Budget, now: number, threshold: number, windowMs: number, blockMs: number): void {
    this.compact(budget, windowMs, now);
    budget.failures.push(now);
    budget.touchedAt = now;
    if (budget.failures.length >= threshold) {
      budget.blocks += 1;
      budget.blockedUntil = now + Math.min(blockMs * 8, blockMs * 2 ** Math.min(3, budget.blocks - 1));
      budget.failures = [];
    }
  }

  private makeRoom(now: number): void {
    if (this.sources.size < this.config.maxSources) return;
    for (const [key, budget] of this.sources) {
      this.compact(budget, this.config.windowSeconds * 1_000, now);
      if (budget.failures.length === 0 && budget.blockedUntil <= now) this.sources.delete(key);
    }
    if (this.sources.size < this.config.maxSources) return;
    const oldest = [...this.sources].toSorted((left, right) => left[1].touchedAt - right[1].touchedAt)[0];
    if (oldest !== undefined) this.sources.delete(oldest[0]);
  }
}
