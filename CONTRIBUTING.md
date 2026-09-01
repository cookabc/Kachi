# Contributing to Kachi

Kachi welcomes code, curriculum, translation, and review contributions.

1. Create a focused branch and keep generated output out of commits.
2. Run `pnpm check` before opening a pull request. It lints and formats with
   Biome, validates course content, typechecks, runs the unit tests, and builds
   the PWA. `pnpm format` fixes lint/format findings in place; a pre-commit hook
   (installed automatically via `pnpm install`) applies it to staged files.
3. Sign every commit with `git commit -s`; Kachi uses the DCO and does not use
   a CLA or copyright assignment.
4. Content changes must include sources, applicability, risk classification,
   and review metadata. Do not copy news articles or use unlicensed artwork.
5. Time-sensitive, jurisdictional, tax, and regulatory content needs a
   financial-domain reviewer before merge.

By contributing, you retain copyright and license the contribution under the
license assigned to its destination directory.
