import { describe, expect, test } from "bun:test";
import { terminalMatches, type BufferLine } from "./search.ts";

type Cell = readonly [string, number];
function line(cells: readonly Cell[], isWrapped = false) {
  return {
    length: cells.length,
    isWrapped,
    getCell(column: number) {
      const cell = cells[column];
      return cell === undefined ? undefined : { getChars: () => cell[0], getWidth: () => cell[1] };
    },
  };
}
function buffer(lines: BufferLine[]) {
  return { length: lines.length, getLine: (row: number) => lines[row] };
}

describe("terminal Find selects cells rather than UTF-16 offsets", () => {
  test("wide and combining characters do not shift the following match", () => {
    const screen = buffer([line([["A", 1], ["中", 2], ["", 0], ["e\u0301", 1], ["Z", 1], ["", 1]])]);
    expect(terminalMatches(screen, 6, "中e\u0301")).toEqual([{ column: 1, row: 0, length: 3 }]);
    expect(terminalMatches(screen, 6, "z")).toEqual([{ column: 4, row: 0, length: 1 }]);
  });

  test("a supplementary glyph selects its whole wide cell", () => {
    const screen = buffer([line([["x", 1], ["𠀀", 2], ["", 0], ["y", 1]])]);
    expect(terminalMatches(screen, 4, "𠀀")).toEqual([{ column: 1, row: 0, length: 2 }]);
  });

  test("soft wraps join a match but hard line boundaries do not", () => {
    const first = line([["a", 1], ["b", 1], ["c", 1], ["d", 1]]);
    const second = [["e", 1], ["f", 1], ["", 1], ["", 1]] as const;
    expect(terminalMatches(buffer([first, line(second, true)]), 4, "CDef")).toEqual([
      { column: 2, row: 0, length: 4 },
    ]);
    expect(terminalMatches(buffer([first, line(second)]), 4, "CDef")).toEqual([]);
  });
});
