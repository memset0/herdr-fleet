import { findMatches } from "../../../web/src/lib/find.ts";

interface BufferCell {
  getChars(): string;
  getWidth(): number;
}

export interface BufferLine {
  readonly length: number;
  readonly isWrapped: boolean;
  getCell(column: number): BufferCell | undefined;
}

export interface SearchBuffer {
  readonly length: number;
  getLine(row: number): BufferLine | undefined;
}

export interface TerminalMatch {
  readonly column: number;
  readonly row: number;
  readonly length: number;
}

/** Translate text offsets to cells only while Find is open; wide/combined glyphs are one token. */
export function terminalMatches(buffer: SearchBuffer, columns: number, query: string): TerminalMatch[] {
  const needle = query.trim();
  if (needle === "") return [];
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];
  for (let row = 0; row < buffer.length; row += 1) {
    const line = buffer.getLine(row);
    if (line === undefined) continue;
    const wrapped = buffer.getLine(row + 1)?.isWrapped === true;
    let last = line.length;
    if (!wrapped) {
      while (last > 0) {
        const cell = line.getCell(last - 1);
        if (cell !== undefined && (cell.getWidth() === 0 || cell.getChars().trim() !== "")) break;
        last -= 1;
      }
    }
    for (let column = 0; column < last; column += 1) {
      const cell = line.getCell(column);
      if (cell === undefined || cell.getWidth() === 0) continue;
      const chars = cell.getChars() || " ";
      const start = row * columns + column;
      text += chars;
      for (let unit = 0; unit < chars.length; unit += 1) {
        starts.push(start);
        ends.push(start + cell.getWidth());
      }
    }
    if (!wrapped && row + 1 < buffer.length) {
      text += "\n";
      starts.push((row + 1) * columns);
      ends.push((row + 1) * columns);
    }
  }
  return findMatches(text, needle).map(({ start, end }) => {
    const first = starts[start]!;
    return {
      column: first % columns,
      row: Math.floor(first / columns),
      length: ends[end - 1]! - first,
    };
  });
}
