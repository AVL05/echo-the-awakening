# Graphics and 3D experience instructions

Scope: `src/scene/`. Read the root `AGENTS.md`.

- Prioritize clear cinematographic composition, navigation, readable interaction targets and stable input over costly visual effects.
- Use Three.js/R3F with WebGPU as preferred renderer and WebGL 2 as genuine fallback. Guard unsupported shaders/features explicitly; keep TSL paths and fallbacks aligned.
- Preserve the first-person experience, pointer lock, keyboard and touch controls, raycasting, three connected zones, scripted transitions and both endings.
- Optimize measured frame time, draw calls, geometry, GPU/CPU memory and load time. Treat headless FPS as indicative, not a physical-device benchmark. Avoid unnecessary render loops, allocations and offscreen effects.
- Respect quality profiles and accessibility settings, including reduced motion where available; effects must not obscure puzzle cues.
- Keep graphics independent from model availability; AI inference must not freeze the scene or interrupt controls.
- Test WebGPU and WebGL 2 paths when available, report missing-device/browser coverage, and include real screenshots for visual regressions only when captured.
