# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2025-05-05

### Added

- **Snippet Manager** (`src/snippets.ts`, 8 tools) — Save, search, retrieve, update, and delete code snippets with auto-detected language (40+ languages supported), tags, descriptions, and view tracking. Export/import JSON backups with merge-on-conflict.
- **Template Engine** (`src/templates.ts`, 6 tools) — 11 built-in boilerplate templates: React component, custom hook, API route, test file, Python function, Rust struct, Go HTTP handler, SQL table, Dockerfile, GitHub Action workflow, and README. Create custom templates with `{{VariableName}}` substitution. Render to file or inline.
- **Batch File Operations** (`src/batch-files.ts`, 6 tools) — batch_read, batch_write, batch_edit, batch_delete, batch_copy, batch_move. Process multiple files atomically with per-file error reporting and metadata (size, line count, bytes).
- **Archive Support** (`src/archive.ts`, 5 tools) — create_archive (zip/tar/tar.gz), extract_archive, get_archive_info, gzip_file, gunzip_file. Cross-platform using PowerShell on Windows and native Unix tools on macOS/Linux.
- **Config Manager** (`src/config.ts`, 7 tools) — Sectioned configuration with defaults: preferences, memory, http, git, snippets, templates, ui. get_config, set_config (auto-JSON-parse), reset_config, list_config_sections, delete_config_key, export_config, import_config.
- **34 new tests** across 5 new test files: `snippets.test.ts` (10 tests), `templates.test.ts` (11 tests), `batch-files.test.ts` (6 tests), `archive.test.ts` (2 tests), `config.test.ts` (7 tests).
- Server now registers **95+ tools** in `index.ts` (up from 81).

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
