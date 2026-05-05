# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] - 2025-05-05

### Added

- **CSV Utilities** (`src/dev-utils.ts`, 2 tools) — `csv_parse` to parse CSV text to JSON with support for quoted fields and custom delimiters, `csv_format` to convert JSON arrays to CSV with proper escaping.
- **Markdown Table Formatter** (`src/dev-utils.ts`, 1 tool) — `markdown_table` to convert JSON arrays to markdown tables with auto-calculated column widths.
- **File Diff Tool** (`src/files.ts`, 1 tool) — `diff_files` to compare two files directly and show differences with configurable context lines.
- **Database Batch Operations** (`src/database.ts`, 3 tools) — `db_batch_set` to batch set multiple key-value pairs, `db_batch_get` to batch get multiple keys, `db_clear_store` to clear all keys in a store.
- **Enhanced Framework Detection** (`src/scanner.ts`) — Added 8 new framework detectors: Playwright, Zod, Biome, Turborepo, Nx, TanStack Query, shadcn/ui, and Bun (runtime detection).
- **Expanded Test Coverage** — Added 9 new tests for ai-commit (up to 5 tests), 6 new tests for git-tools (up to 11 tests), 4 new tests for CSV/markdown utilities, 2 new tests for diff_files, and 4 new tests for database batch operations.
- **Total Test Count** — 170 tests passing (up from 146), 2 skipped.

### Changed

- Updated `csvFormat` and `markdownTable` function signatures to accept arrays directly instead of JSON strings for better MCP tool integration.
- Fixed `dbBatchGet` to return an array of results with `key`, `value`, and `found` properties for consistent API.
- Fixed test expectations in `ai-commit.test.ts` and `git.test.ts` to match actual function return formats.

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
