# Contributing

Thanks for your interest in `@ilpachi/use-alova`. Code, comments, README and commit messages are in English.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md). Report vulnerabilities privately (see [SECURITY.md](./SECURITY.md)).

## Setup

Requires Node >= 20.19 (or >= 22.12) and [pnpm](https://pnpm.io): the build tooling (Vite 8) needs it, while the published package still supports Node >= 20.

The project builds with TypeScript 7. Tools that still need the TypeScript JS API (vite-plugin-dts, `scripts/postbuild.mjs`, TypeDoc) use the `@typescript/typescript6` fallback; this is a transition dependency, to remove once they support TypeScript 7 (`.pnpmfile.cjs` hands it to TypeDoc).

```sh
pnpm install
```

## Commands

- `pnpm test` - run the tests (vitest; unit tests on happy-dom, integration tests against a real local HTTP server).
- `pnpm lint` - oxlint on `src` (config in `.oxlintrc.json`).
- `pnpm format` / `pnpm format:check` - oxfmt (config in `.oxfmtrc.json`): write / check only.
- `pnpm typecheck` - `tsc --noEmit` on sources and on tests.
- `pnpm build` - library build (one ES + CJS entry per subpath, unminified, declarations, `dist/overlay.css`), then a type check of the published declarations (`scripts/consumer-check.ts`).
- `pnpm docs:api` - generate the TypeDoc API reference into `docs/api` (not versioned).

Run lint, format check, typecheck, test and build before opening a change (`pnpm prepublishOnly` runs all of them).

## Conventions

- TypeScript and ES Modules only; JSDoc on every function and class.
- Style is enforced by oxfmt (2 spaces, single quotes, no semicolons) and oxlint (`import type` for type-only imports, template literals instead of concatenation).
- Tests live next to the source as `*.test.ts`; end-to-end ones are in `src/integration.test.ts` with helpers in
  `src/test-utils/`. Add or update tests with every behavior change.
- Notification text must be inserted with `textContent`, never as HTML.
- No dependency on a UI framework, and the core (`src/core`) never imports from `src/notify`, `src/overlay`, `src/files` or `src/csrf`: a new feature that needs the DOM or a UI belongs in a subpath. A new subpath needs an entry in `vite.config.ts`, in `package.json#exports` and `typesVersions`, in `tsconfig.dist.json` and in `typedoc.mjs`.
- Update `README.md` (the single hand-written reference) and `CHANGELOG.md` when behavior or options change.

## Commit messages

Conventional style, in English, imperative mood, subject up to ~72 characters:

```
<type>: <short summary>
```

Types: `feat` (new feature), `fix` (bug fix), `docs` (documentation only), `test` (tests only), `refactor` (no behavior
change), `perf` (performance), `ci` (CI workflow) and `chore` (tooling, dependencies, releases). For example
`fix: send the token only to same-origin requests`. Add the version in parentheses when a commit is part of a release,
e.g. `fix: reject invalid cookie expires (1.0.3, part 1)`. Describe breaking changes in the body.

## Pull request flow

1. Create a branch from `main` (`feat/...`, `fix/...`, `docs/...`).
2. Keep the change focused; add or update tests and the README, and an entry in the `## [Unreleased]` section of `CHANGELOG.md`.
3. Make sure `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
4. Open the pull request describing what changed and why, and call out any behavior change that could affect consumers.
5. Address the review comments with new commits; the maintainer merges when everything is green.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Every user-visible change goes under
`## [Unreleased]` in one of the categories `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. Behavior
changes that can break consumers must be marked as such. On release, the `Unreleased` entries move under a new
`## [x.y.z] - YYYY-MM-DD` heading.

## Versioning

The package follows [Semantic Versioning](https://semver.org/):

- **patch** (`1.0.x`): bug and security fixes, documentation, internal changes, no public API change;
- **minor** (`1.x.0`): backward compatible additions (new options, exports, types) and deprecations;
- **major** (`x.0.0`): breaking changes (removed or renamed exports/options, changed defaults or behavior).

Deprecated names keep working for at least the rest of the current major version (1.x aliases were removed in 2.0.0).

## Integration tests

`src/integration.test.ts` runs on the `node` environment against a real local HTTP server (`src/test-utils/server.ts`)
and a DOM installed by hand (`src/test-utils/dom.ts`); no `fetch` mock is used. Run all the tests with `pnpm test`, or
only the integration ones with:

```sh
pnpm vitest run src/integration.test.ts
```

Import Vue and the package dynamically after the DOM is installed (see the top of the file), and close every server you
start in `afterAll`.

## Release checklist

1. Bump `version` in `package.json` (SemVer, see above) and add a `## [x.y.z] - YYYY-MM-DD` section to `CHANGELOG.md`
   (move the `Unreleased` entries into it and update the compare links at the bottom).
2. Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`, and check the tarball with
   `npm pack --dry-run --ignore-scripts` (only `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json`).
3. Commit on `main`, then tag and push:

   ```sh
   git tag -a vX.Y.Z -m "Release X.Y.Z"
   git push origin main vX.Y.Z
   ```

4. Push the tag: `release.yml` (GitHub Actions) checks that the tag matches the `package.json` version and that
   `CHANGELOG.md` has a `## [x.y.z]` section, runs lint, typecheck, tests and build, then publishes to npmjs with
   `npm publish --provenance --access public`. Pre-release versions (e.g. `1.2.0-beta.1`) are published with the
   `next` dist-tag.
5. The release job is rerun-safe: if the version already exists on npmjs it skips the publish and succeeds.
   Fallback only: `npm publish` by hand (**never** `pnpm publish`: it breaks the README).

### CI and publishing setup (maintainers)

- `ci.yml` runs lint, format check, typecheck, tests, build and `npm pack --dry-run` on push and pull requests to `main`.
- `release.yml` uses npm trusted publishing (OIDC, `id-token: write`): configure the package on npmjs with a trusted
  publisher (repository `ellethee/use-alova`, workflow `release.yml`). No token or secret is stored in the repository.
- `docs.yml` builds the MkDocs site (`--strict`) and deploys it to GitHub Pages (enable Pages with source "GitHub
  Actions" in the repository settings).
- Dependabot (`.github/dependabot.yml`) proposes weekly updates for npm and GitHub Actions.
