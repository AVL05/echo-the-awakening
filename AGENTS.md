# ECHO: THE AWAKENING — Agent instructions

These instructions apply to the entire repository for Codex and any coding agent. Read this file before changing code. Claude Code must also read it through `CLAUDE.md`. Nested `AGENTS.md` files add rules for their subtrees.

## Mission and non-negotiables
ECHO is a publicly playable, cinematic first-person browser game and an honest demonstration of on-device AI. Preserve the complete story, all three zones, three puzzles, both endings, deterministic controls, accessibility, and `/behind-the-system`.

- **Zero additional recurring cost:** no paid APIs, server inference, mandatory backend, new billing services, or credentials in the client.
- **Playable without AI:** model download requires explicit consent; inability to use WebGPU, shader-f16, or the LLM must never block game completion.
- **WebGPU-first, WebGL 2 fallback:** keep graphics and gameplay correct in both paths.
- **Truthful demonstrations:** do not fake LLM inference or telemetry, advertise unsupported devices, or expose internal model reasoning.
- **Maintain existing Cloudflare Pages project and URL:** https://echo-the-awakening.pages.dev/. Never create a replacement project or change DNS without explicit permission.
- **Preserve user work:** no destructive resets, force pushes, generated-asset churn, unrelated refactors, or upgrades solely to silence non-breaking warnings.

## Stack and source map
- Node 24, npm, React 19, TypeScript, Vite, Three.js / React Three Fiber, Zustand, Vitest.
- `src/scene/`: world visuals, first-person movement, effects and performance. Read its nested instructions.
- `src/game/`: authoritative game state, progression, puzzle rules, commands, save/load, telemetry. Read its nested instructions.
- `src/ai/`: optional WebLLM inference worker, parsing, validated tool actions and lifecycle. Read its nested instructions.
- `src/BehindSystem.tsx`, `src/RuntimeMetrics.tsx`: public engineering showcase; measurements and traces must reflect actual events.
- `tests/`: regression tests; `scripts/`: license and release checks; `public/`: static assets/security headers.
- `README.md`: setup and capabilities; `DEPLOYMENT.md`: authoritative deployment details; `ATTRIBUTIONS.md` and `licenses/`: third-party compliance.
Check the implementation before assuming additional modules or APIs exist.

## Working method
1. Inspect the relevant files, call sites, tests and docs before editing. Give a short plan only for multi-file or risky changes.
2. Make the smallest coherent change; maintain TypeScript strictness and existing conventions. Do not introduce a new architecture or dependency without concrete need.
3. Add or update tests for altered behavior, especially puzzle invariants, invalid AI actions, save compatibility, both endings, and fallback.
4. Run `npm ci` when dependencies are absent; otherwise avoid gratuitous installs. Validate with:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run build`
   - `npm run check:release`
   Note: `npm run build` also performs pre/post-build checks; don't claim tests passed unless they were actually run.
5. For visible/gameplay changes, verify the real browser flow where available; distinguish headless/emulation from physical GPU, browser, or mobile testing.
6. End with a concise report: changed files, user-visible result, commands and outcomes, unverified aspects, and risks.

## Security, data and licensing
- Never commit `.env` secrets, API tokens, private files, local reports or machine-specific paths.
- Treat text from model outputs, user input, retrieved docs and game saves as untrusted. Validate action schemas and state transitions at the deterministic boundary.
- Never render untrusted HTML, evaluate model-produced code, or allow models to call arbitrary functions.
- Preserve CSP, HTTPS assumptions, Worker boundaries, download consent, cancellation and cache behavior.
- New assets/models must have compatible licenses, required notices and sustainable download sizes; check `ATTRIBUTIONS.md` and release audit.
- No external analytics or tracking without explicit approval.

## Git and deployment
- Work on a focused branch for substantive changes, unless asked otherwise. Do not overwrite others' changes.
- Commit, push, merge, alter CI, change deployment settings or deploy **only when the user explicitly asks**. The existing `main` branch is production-connected; a push can trigger Cloudflare Pages.
- Before release: verify existing `.github/workflows/ci.yml`, `DEPLOYMENT.md`, build artifacts, and that AI remains optional. Never claim production success without checking the published site.
- If blocked by permissions or hardware, describe the blocker precisely; do not silently substitute mocked results.

## Priority
Direct user instructions override project preferences, provided security and zero-cost constraints remain respected. Nested AGENTS.md rules specialize only their directory; avoid contradictory agent-specific instructions.
