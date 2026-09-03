/** Width-only manual resize result; rows are preserved bridge-side from Herdr's current viewport. */
export type PaneResizeResponse =
  | { ok: true; cols: number; rows: number }
  | { ok: false; error: string };
