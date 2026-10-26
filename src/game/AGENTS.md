# Game mechanics instructions

Scope: `src/game/`. Read the root `AGENTS.md`.

- This directory is authoritative for world state, puzzle prerequisites, commands, storytelling, telemetry, audio and persistence. Visuals and AI must adapt to game rules, not bypass them.
- Preserve all three connected zones, the documented investigations, three puzzles and two reachable endings. Any changes must be completable **with no LLM**.
- Keep updates deterministic, auditable and validated; rejected actions must not mutate progress. Avoid saving impossible/intermediate states.
- Preserve backward compatibility with existing browser saves when possible; add explicit versioned migrations when schema changes require them.
- Keep trace steps faithful to actual input, validation, execution and state deltas; never fabricate telemetry for the technical showcase.
- Make physical interactions, keyboard/mouse, touch and terminal controls lead to consistent outcomes.
- Extend `tests/` for state invariants, both final paths, invalid commands, persistence/recovery and regression cases.
