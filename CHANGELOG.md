# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
