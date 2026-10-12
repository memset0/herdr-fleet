import { graphemeSegmenter } from "../../env";
import { collapsesAsPaste } from "./paste";

// A reply opencode would summarise as a paste goes out as ONE part, framed as a bracketed paste
// (paste.ts has the probe and the reason: typing a long draft in is slower than the guard can wait
// for). Everything else is short enough to be inserted literally and is typed, split by the same
// conservative transport bounds omp uses, minus omp's own quirks: keep each part small enough that
// the literal echo stays on screen for the reply guard to verify, and never end a part where the
// next begins with a character that could read as an accidental command.
const MAX_CHUNK_CHARS = 512;
const MAX_CHUNK_NEWLINES = 4;

export function opencodeReplyChunks(text: string): string[] {
  if (collapsesAsPaste(text)) return [text];
  const segmenter = graphemeSegmenter();
  const characters = segmenter
    ? Array.from(segmenter.segment(text), (s) => s.segment)
    : Array.from(text);
  const chunks: string[] = [];
  let chunk = "";
  let newlines = 0;
  for (const character of characters) {
    const count = (character.match(/\n/g) ?? []).length;
    // Do not start a new chunk on a character that could read as a leading slash/tilde/dot token at
    // the boundary: the box renders the boundary invisibly, so the split must not manufacture text.
    if (
      chunk &&
      !/^[/~.]/.test(character) &&
      (chunk.length + character.length > MAX_CHUNK_CHARS || newlines + count > MAX_CHUNK_NEWLINES)
    ) {
      chunks.push(chunk);
      chunk = "";
      newlines = 0;
    }
    chunk += character;
    newlines += count;
  }
  if (chunk) chunks.push(chunk);
  return chunks.length ? chunks : [text];
}
