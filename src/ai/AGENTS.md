# On-device AI instructions

Scope: `src/ai/`. Read the root `AGENTS.md` and these rules before editing.

- AI is optional, runs in a Web Worker through WebLLM, and downloads model weights only with affirmative consent. Never add a paid endpoint or mandatory server.
- `controller.ts` orchestrates lifecycle and the UI; `echo.worker.ts` owns inference; `protocol.ts` defines communication; `actions.ts` parses and validates permitted plans. Check existing contracts rather than inventing alternate APIs.
- LLM output is **a proposal, never authoritative state**. Parse a strict bounded schema; validate action identifiers, arguments, permissions and prerequisites against current `src/game/` state. Avoid arbitrary code execution and implicit side effects.
- Preserve cancellation/session invalidation, stale proposal rejection, single-flight inference, timeouts, error recovery, diagnostics and deterministic fallback.
- Bound context/history, input and output sizes. Do not increase model size/download or GPU memory pressure without measured justification and a clear consent UX.
- Never label deterministic replies as LLM results. Show truthful status, latency and errors; do not expose hidden reasoning.
- Add focused tests for malformed JSON, prohibited or stale actions, concurrent requests, cancelled tasks, save restoration and unsupported GPU behavior.
- Verify real inference only where the runtime actually supports it; distinguish mocked tests, cached loads and cold downloads.
