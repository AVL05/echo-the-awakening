# Cloudflare Pages delivery

Public URL: **https://echo-the-awakening.pages.dev/**. Repository: **https://github.com/AVL05/echo-the-awakening**. Reuse the existing Pages project `echo-the-awakening`; do not create another project, rename it or change DNS to update this game.

## Configuration

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | repository root |
| Node | 24, from `.node-version` |
| Required secrets/environment variables | none |

`wrangler.jsonc` identifies the existing project and output. No Pages Functions, server Workers, R2, KV, paid inference, API keys or DNS changes are required. Cloudflare manages `pages.dev` HTTPS.

## Integration status

GitHub CI is defined in `.github/workflows/ci.yml` on every push and pull request. The initial push passed its real Linux workflow, including installation, TypeScript, lint, 38 tests, build and output audit.

On 26 October 2026, the existing project's **Settings → Git repository → Connect** accepted `AVL05/echo-the-awakening`. The saved settings show production `main`, automatic deployments enabled, command `npm run build` and output `dist`. No project recreation or deployment token was needed. This account's dashboard accepted the connection despite the older [Direct Upload documentation](https://developers.cloudflare.com/pages/get-started/direct-upload/) describing migration as unsupported.

**Automatic delivery verified:** normal push [`aa548c8`](https://github.com/AVL05/echo-the-awakening/commit/aa548c84b5da2c9bec5cd642e334658dff8a7cd5) triggered production deployment `95911f50-0f49-4abf-8c0d-9643a59ef5af` in the same project. Both the native **Cloudflare Pages** check and [GitHub Actions run](https://github.com/AVL05/echo-the-awakening/actions/runs/40338852035) completed successfully. Later releases can be traced through the same checks on each commit.

GitHub Actions and Pages builds run independently. `npm run build` runs lint and unit tests in prebuild, generates notices, typechecks and builds, then audits the output in postbuild. Failing checks therefore prevent native publication regardless of CI completion order. CI also exposes each check as a separate step.

If GitHub access is requested, authorize the official Cloudflare app for `AVL05/echo-the-awakening`, preserving existing repository selections. Never put credentials in source, workflow YAML, a committed `.env` or build output.

## Verification and rollback

Before pushing: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:release`. CI uses `npm ci` and those checks. After delivery, compare the deployed commit with `main`, inspect the Cloudflare build log, and verify HTTPS, `/`, `/behind-the-system`, CSP, model consent, both endings and renderer fallback separately.

`node scripts/check-public.mjs https://echo-the-awakening.pages.dev` strictly compares local `dist` to public assets, headers, routes and private-path responses. License texts use canonical LF line endings and the public inventory describes distributed runtime dependencies, excluding OS-specific development packages. This keeps the metadata reproducible across Windows and Linux without weakening hash checks.

For a failed release, use the **existing project's** Deployments → last verified production deployment → Rollback. Alternatively, revert the faulty commit normally and push. Never force-push or overwrite remote history. Saves remain in the player's browser; there is no database migration.

## Assets, security and AI

`public/_headers` configures CSP, framing/MIME protection and permissions. HTML revalidates; hashed assets are immutable for a year. `_redirects` serves `/behind-the-system` as the application. No SharedArrayBuffer isolation requirement is imposed on model downloads.

The optional model downloads from pinned Hugging Face/MLC URLs after consent. Conversation text stays on-device. Weight shards are excluded from `dist`: some exceed Pages' **25 MiB per-file** limit. The JavaScript Worker is bundled below it. `check:release` audits the static whitelist, file sizes, notices and obvious secret signatures.

Cached inference is separate from first download. Cache API may be evicted, and a cached model does not make the entire site offline-capable. A failure leaves deterministic gameplay available.

## Free-tier boundaries

Expected additional hosting/inference cost: **€0**, using Pages Free and standard Linux GitHub Actions runners for the public repository. Pages Free currently permits 500 builds/month, one concurrent build and 20,000 files through its build/Wrangler route; every asset must be at most 25 MiB. Dashboard uploads have a separate 1,000-file limit. Limits can change. No paid plan, larger runner or metered storage service is enabled.

Hugging Face/MLC are free external file dependencies without a contracted SLA. Players pay their data/electricity costs and consent to roughly 300 MB of downloads. Existing domain renewal is separate. No custom domain is being connected here.

Official references: [GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/), [build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/), [headers](https://developers.cloudflare.com/pages/configuration/headers/), [limits](https://developers.cloudflare.com/pages/platform/limits/).
