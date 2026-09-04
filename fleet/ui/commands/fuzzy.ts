// Subsequence matching for the command bar, and the positions it matched at.
//
// Subsequence rather than substring, because that is what makes a quick-input feel like one: `otm`
// finds "Toggle Type Mode" and `ntb` finds "Next Tab". Substring matching would need the operator to
// remember where the words break, which is the thing they opened the bar to avoid.
//
// The positions come back with the score because the row has to MARK what it matched. A row that
// highlights nothing leaves the operator checking each result against their own query by eye, which
// is most of the work the highlight was supposed to remove.
//
// Pure and total, and deliberately small: no index, no cache, no worker. The catalog is tens of rows
// and a roster is hundreds, so a linear scan per keystroke is far below the frame budget, and a
// faster structure would be a second source of truth about what matches.

export interface FuzzyMatch {
  /** Higher is better. Only meaningful against other matches of the same query. */
  readonly score: number;
  /** Indices into the candidate, ascending, one per matched query character. */
  readonly positions: readonly number[];
}

/**
 * The same match, plus WHICH field produced it.
 *
 * The field index is not decoration: `positions` indexes into that field's string, so a row that
 * marked them against a different field would highlight the wrong characters. A row that matched on
 * something it does not display — an id, a binding label — marks nothing and shows the plain name.
 */
export interface FuzzyFieldMatch extends FuzzyMatch {
  readonly fieldIndex: number;
}

/** A word does not begin mid-word: these are what a "start of word" is bounded by. */
function isBoundary(previous: string | undefined): boolean {
  if (previous === undefined) return true;
  return previous === " " || previous === "-" || previous === "_" || previous === "/" || previous === ".";
}

/** A match that begins a word is what the operator almost always meant. */
const BOUNDARY_BONUS = 12;
/** A run is evidence they were typing the word rather than hitting letters that happen to appear. */
const ADJACENT_BONUS = 8;

/**
 * Match `query` against `candidate` as a subsequence, case-insensitively, choosing the BEST
 * alignment rather than the leftmost one.
 *
 * Best rather than greedy, and that is not a refinement — greedy is wrong here. `tab` against
 * `Next Tab` greedily takes the `t` of `Next`, so the alignment never starts at a word boundary,
 * the boundary bonus never applies, and the row highlights `Nex*t* T*ab*` instead of `*Tab*`. The
 * ranking is dominated by that bonus, so an aligner that cannot find it makes the bonus decorative.
 *
 * The search is the textbook two-choice recursion over (query index, candidate index) — take the
 * next occurrence, or skip past it — memoised, so it is linear in their product rather than
 * exponential. Candidates here are command names and Pane labels, so this is microseconds.
 *
 * Returns `null` when the query is not a subsequence at all. An empty query matches everything with
 * a zero score and no positions — the "browse the whole list" case, not a special mode.
 */
export function fuzzyMatch(query: string, candidate: string): FuzzyMatch | null {
  // A space in the query means "somewhere later", not a literal space to find.
  const needle = query.toLowerCase().replaceAll(" ", "");
  if (needle === "") return { score: 0, positions: [] };

  const hay = candidate.toLowerCase();
  if (needle.length > hay.length) return null;

  // `adjacent` says whether a match landing exactly at `from` would continue the previous run. It is
  // part of the state because the same (i, from) pair scores differently depending on it.
  const memo = new Map<number, FuzzyMatch | null>();

  function best(i: number, from: number, adjacent: boolean): FuzzyMatch | null {
    if (i === needle.length) return { score: 0, positions: [] };
    const memoKey = (i * (hay.length + 1) + from) * 2 + (adjacent ? 1 : 0);
    const cached = memo.get(memoKey);
    if (cached !== undefined) return cached;

    const at = hay.indexOf(needle.charAt(i), from);
    let answer: FuzzyMatch | null = null;
    if (at !== -1) {
      // Take it.
      const rest = best(i + 1, at + 1, true);
      if (rest !== null) {
        let score = rest.score;
        if (isBoundary(hay[at - 1])) score += BOUNDARY_BONUS;
        if (adjacent && at === from) score += ADJACENT_BONUS;
        // An earlier start beats a later one: the closer the candidate is to BEING the query, the
        // more likely it is the row that was meant.
        if (i === 0) score -= at;
        answer = { score, positions: [at, ...rest.positions] };
      }
      // …or skip it and look for a later, better-placed occurrence.
      const skipped = best(i, at + 1, false);
      if (skipped !== null && (answer === null || skipped.score > answer.score)) answer = skipped;
    }
    memo.set(memoKey, answer);
    return answer;
  }

  const found = best(0, 0, false);
  if (found === null) return null;
  // A shorter candidate beats a longer one holding the same match, for the same reason.
  return { score: found.score - Math.floor(candidate.length / 8), positions: found.positions };
}

/**
 * Match against several fields and keep the best.
 *
 * A command is searchable by its English name, its id and its binding labels, and a Pane by its own
 * label and its context. The caller passes them in priority order and the earlier field wins a tie,
 * so `Next Tab` matched on its name outranks a command whose BINDING happened to contain the same
 * letters.
 */
export function fuzzyMatchAny(query: string, fields: readonly string[]): FuzzyFieldMatch | null {
  let best: FuzzyFieldMatch | null = null;
  for (const [fieldIndex, field] of fields.entries()) {
    const match = fuzzyMatch(query, field);
    if (match === null) continue;
    if (best === null || match.score > best.score) best = { ...match, fieldIndex };
  }
  return best;
}
