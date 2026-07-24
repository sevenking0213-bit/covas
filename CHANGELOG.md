# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-XX-XX

### Added

- Initial release
- `@covas/workspace` — Core single-image annotation workspace with Konva
- `@covas/bridge` — Host-neutral open/submit lifecycle bridge
- `@covas/shared-types` — Public TypeScript contracts
- `@covas/adapter-web` — Web/React integration adapter
- `@covas/adapter-codex` — Codex adapter
- `@covas/session-store` — Session persistence helpers
- `apps/playground-web` — Local playground demo
- `apps/codex-widget` — Codex widget entrypoint
- `examples/web-basic` — Minimal integration example
- Annotation tools: pan, brush, rectangle, ellipse, arrow, text
- Submit payload with attachments, message draft, and structured annotation data
- MIT License
- GitHub Actions CI pipeline

### Known Limitations

- Single active annotation target at a time
- Bottom thumbnails serve as navigation only (no editing)
- No version tree / graph visualization
- No multi-user collaboration
