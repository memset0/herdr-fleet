# Provenance of the vendored needle engine

These files are the speech engine behind Collie's Whistle option (ADR 0096). They are copied byte
for byte from upstream. Nothing here was edited, formatted or rebuilt.

- Source repository: https://huggingface.co/Cactus-Compute/needle3 (Cactus-Compute/needle3)
- Commit: `93e88ede867e4311c39151285e74df513e4b835b`
- Path in the repository: `wasm/needle.js`, `wasm/needle.wasm`, and `LICENSE` at the root
- LICENSE source: https://huggingface.co/Cactus-Compute/needle3/resolve/93e88ede867e4311c39151285e74df513e4b835b/LICENSE
- Licence: Apache License 2.0 (the full text is in `LICENSE` beside this file)
- Vendored on: 2026-10-11

| File | Size in bytes | sha256 |
| --- | --- | --- |
| `needle.js` | 63072 | `964681b2a5ec3c4db2f06e45a5b60c8981a7d4ab4cac16ef6bf5b1988657a5f1` |
| `needle.wasm` | 929343 | `70bdb02b80d062b52cab1597e508b71172a7b355fc448840077a3929170a0733` |
| `LICENSE` | 11358 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |

The model is not here. The host downloads it once from a pinned Hugging Face revision; see
`bridge/stt/whistle-pins.ts`.

## How to re-vendor

A maintainer does this in one commit. A bot never does. Fetch the new `needle.js`, `needle.wasm` and
`LICENSE` at the new upstream commit. Then read the diff of `needle.js` and the diff of the wasm
import list with your own eyes. The import list is everything the wasm can ask its host to do, so a
new import is a reason to stop. Update this file, the version directory name, and the pins in
`bridge/stt/whistle-pins.ts` and `web/src/stt/pins.ts`. Then run `bun test bridge/stt/whistle-pins.test.ts`.
Do not run a formatter or a linter fix over these files: the served bytes must be the hashed bytes.
