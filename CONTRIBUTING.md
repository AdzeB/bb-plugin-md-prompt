# Contributing

Open an issue for a bug or a proposed change, with your BB version and a small
synthetic Markdown example. Do not include private prompts, project names,
credentials or full-window screenshots.

## Local development

Use Node 24, then run:

```sh
npm ci --ignore-scripts
npm run check
npm run build
bb plugin install .
bb plugin dev
```

The SDK and build tool are pinned in `package.json`. Runtime dependencies
belong in `dependencies`; packages BB provides at runtime stay in
`devDependencies`. Keep the copied parser unchanged unless an upstream change
is deliberately incorporated and attributed in `THIRD_PARTY_NOTICES.md`.

## Verification

Run the browser workflow against an installed plugin in a local BB instance:

```sh
npx playwright install chromium
npm run verify:e2e
```

Set `BB_SERVER_URL` when running outside a BB thread. The browser is headless,
uses an isolated profile, and never submits a prompt. Check `results.json` and
open the composer-only PNGs in `artifacts/e2e/`. Traces are off by default;
`MD_PROMPT_TRACE=1` enables a local trace that can contain private app-shell
information. Never upload a trace or a full-window capture publicly.

## Releases

Add user-visible changes under `Unreleased` in `CHANGELOG.md`. For a release,
update the version in `package.json` and the lockfile, move those notes to a
dated version heading, and update the comparison links. Verify with
`npm run check`, `npm run build` and the browser workflow before tagging.

Publish an annotated immutable `vX.Y.Z` tag on `main`. The Release workflow
checks that the tag, package version and changelog agree, builds the plugin,
and creates a GitHub release from that version's changelog section. It attaches
a built npm-format archive and its SHA-256 checksum; it does not publish to npm.
Never move an existing release tag. Ship a new version for a correction.

The BB Community entry tracks `^0.1.0`. A new marketplace pull request is needed
for a source, metadata or tracking-range change. Marketplace maintainers review
and merge submissions separately from this repository's releases.
