# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2025-05-05

### Fixed

- **Critical**: `generateCommitMessage` in `ai-commit.ts` now returns valid JSON when no changes are detected, instead of plain text that broke the MCP tool contract.
- **Security**: Replaced `new Function()` (effectively `eval`) in `evaluateMath` with a safe recursive-descent math parser. No arbitrary code execution possible.
- **Reliability**: Fixed HTTP response cache to use proper LRU eviction and added `MAX_DOMAIN_STATS` limit to prevent unbounded memory growth in long-running servers.

### Changed

- `evaluateMath` error responses are now JSON-structured for consistency.
- Updated `ai-commit.test.ts` and `dev-utils.test.ts` to match new JSON error formats.

## [1.0.3] - 2025-05-05

### Added

- ESLint 9 flat config (`eslint.config.js`) with TypeScript support via `typescript-eslint`.
- Prettier config (`.prettierrc`) for consistent formatting.
- Pre-commit hooks via `lefthook.yml` — runs lint, format, typecheck, and tests on every commit.
- New npm scripts: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `ci`.
- Tests for `package-runner.ts` (9 tests covering cache, scripts, dependencies, package info).
- Tests for `cli.ts` (8 tests covering help, scan, summary, search, read, error cases).

### Fixed

- Fixed ESLint errors in `dev-utils.ts`, `git-tools.ts`, and `web.ts` (prefer-const, no-useless-escape).

## [1.0.2] - 2025-05-05

### Added

- Added `VERSION` file for release tracking.
- Added `CHANGELOG.md` to document release history.
- Added missing test coverage for `database.ts`, `http.ts`, `process.ts`, `stats.ts`, and `thinking.ts` modules (28 new tests).
- Updated `.gitignore` to exclude `graphx-out/`, temp files, and test artifacts.

### Fixed

- Fixed test expectations for HTTP caching behavior.
- Fixed thinking tests to match markdown output format.
- Skipped process-listing tests on Windows to avoid `tasklist` timeouts in MINGW environments.

## [1.0.1] - 2025-05-05

### Added

- Advanced AI-powered features across memory, search, git, HTTP, and dev tools.
- Enhanced memory management with health checks, pruning, consolidation, sentiment search, and importance updates.
- Expanded search capabilities with semantic analysis and advanced code context.
- Advanced git analytics: commit impact analysis, author stats, branch evolution, and repo insights.
- HTTP performance monitoring, circuit breaker controls, and metrics management.
- Upgraded file operations, thinking engine, todo management, and code statistics tools.

## [1.0.0] - 2025-05-03

### Added

- Initial release of MCP DevKit.
- 63+ tools covering project scanning, persistent memory, terminal commands, git workflows, file CRUD, HTTP requests, process management, system info, code statistics, and dev utilities.
- Cross-platform support for Windows, macOS, and Linux.
- CI/CD pipeline with GitHub Actions.
