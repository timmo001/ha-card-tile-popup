# Tile Popup Card

A Home Assistant dashboard card (`custom:tile-popup`): a tile that opens a popup holding other cards. It's written in Lit and TypeScript and built into one module, `dist/tile-popup.js`, which HACS and manual installs load.

## Stack

- pnpm 12, pinned in `package.json` and `mise.toml`, on Node 26
- Rolldown builds `src/` into `dist/` (`rolldown.config.mjs`, Babel for the output)
- Oxlint with the shared `@timmo001/oxlint-rules` preset and type-aware checks (`oxlint.config.ts`)
- Prettier for formatting
- `vendor/home-assistant-frontend` is a shallow submodule for reference. Lint and format skip it.

## Checks

- `mise run check` runs lint, the format check and the build. Run it before a push. `mise run format` writes formatting fixes.
- `mise run lint`, `mise run build` and `pnpm start` (a watch build) run one part at a time.
- `hk.pkl` is the pre-push hook: the shared Markdown, YAML, Actions and shell lints, plus Oxlint. Install it once with `hk install`.
- `pnpm publish-to-local` copies the built bundle to a Home Assistant instance over SSH. It reads `.env`, from `.env.example`.

## Rollout

- Changes go straight to `main`, with a short imperative commit subject. Renovate opens dependency updates and automerges the ones that pass.
- CI runs Lint, Build and HACS Validate from the shared workflows in `timmo001/workflows`, pinned to a tag.
- A release is a published GitHub release. The Release workflow builds `tile-popup.js` and attaches it. Don't hand-edit `dist/`.
- The README's install steps are what HACS users follow, so keep them accurate when install changes.
