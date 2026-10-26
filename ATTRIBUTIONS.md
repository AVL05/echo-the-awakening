# Attribution and redistribution

## Original work — MIT

ECHO's original source, procedural architecture, materials, particle/energy effects, SVG icons and synthesized Web Audio sounds are covered by the root [MIT License](LICENSE), copyright 2026 AVL05. The selected images in `docs/images/` are original, unretouched captures of that game. No stock models, HDRIs, recordings, commercial fonts or image-library assets are bundled. Fonts come from the player's operating system; font binaries are not redistributed.

This grant does not replace licenses attached to third-party dependencies or model files. Keep their notices when redistributing.

## Runtime dependencies

| Dependency | License |
| --- | --- |
| React / React DOM | MIT |
| Three.js | MIT |
| React Three Fiber | MIT |
| Zustand | MIT |
| WebLLM / MLC runtime | Apache-2.0 |

Exact installed packages, versions, scopes and license-text hashes are listed in [public/licenses.json](public/licenses.json). [public/THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt) includes license texts for distributed runtime packages and transitives. The repository does not vendor `node_modules/`; npm installs packages under their respective licenses.

`npm run licenses` regenerates the inventory from the lockfile and installed files, rejects unsupported/unknown runtime licenses and includes the model notice. Optional development packages vary by OS, so their inventory entries may differ between Windows and Linux. Runtime notices and model integrity must remain valid on both.

React Three Fiber 9.8.2's published npm package declares MIT but omits LICENSE. Its official text is retained in [licenses/react-three-fiber-LICENSE.txt](licenses/react-three-fiber-LICENSE.txt), with its pinned upstream URL in [licenses/sources.json](licenses/sources.json).

## Optional model — Apache-2.0

- Original: [Qwen2.5-0.5B-Instruct, Qwen Team](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct).
- Conversion: [MLC q4f16_1](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC), pinned to `32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad`.
- MLC WASM runtime: pinned to `00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0`, with SHA-256 verification in [model.ts](src/ai/model.ts).
- License: [public/QWEN-LICENSE.txt](public/QWEN-LICENSE.txt). Weights are unchanged and downloaded voluntarily from the original host; not included in Git or Pages assets.

`node scripts/check-model.mjs` checks the manifest, expected weight size, upstream license and file CORS availability without downloading weight shards. Network/license checks do not prove browser inference.

## Development and CI

Vite, TypeScript, ESLint and Vitest use their declared upstream licenses (MIT/Apache-2.0 and permissive transitives). CI's official checkout/setup-node actions are pinned to source commits. Build output includes runtime notices. Captures, profiles, caches, logs and local audit reports are excluded from Git, except for the explicitly curated documentation images.
