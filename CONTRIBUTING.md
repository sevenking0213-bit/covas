# Contributing to Covas

Thank you for your interest in contributing! Here's everything you need to know.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/your-org/covas.git
cd covas

# Install dependencies
npm install

# Run the playground demo
npm run dev
```

## Monorepo Structure

```
covas/
├── packages/
│   ├── workspace/      # Core annotation workspace (Konva + React)
│   ├── bridge/        # Host-neutral open/submit bridge
│   ├── shared-types/  # Public TypeScript contracts
│   ├── adapter-web/   # Web/React adapter
│   ├── adapter-codex/ # Codex adapter
│   └── session-store/ # Session persistence helpers
├── apps/
│   ├── playground-web/  # Local demo shell
│   └── codex-widget/    # Codex plugin entrypoint
└── examples/
    └── web-basic/       # Minimal integration example
```

## Workflows

### `npm run dev:playground`
Start the local playground demo at `http://localhost:5173`.

### `npm run dev:codex-widget`
Start the Codex widget demo.

### `npm run build`
Build all packages and apps.

### `npm run check`
Type-check all TypeScript files.

### `npm run lint`
Run ESLint.

### `npm run test`
Run all unit tests with Vitest.

### `npm run test:watch`
Run tests in watch mode.

## Coding Standards

- **TypeScript strict mode** — no `any`, full type coverage
- **Component pattern** — use `memo` + `useCallback`/`useMemo` for performance
- **Test coverage** — new features should include tests
- **No breaking changes** to public types in `shared-types`

## Package Publishing

Packages under `packages/` are published to npm as `@covas/*`. To publish:

```bash
# Update version in package.json
npm run build
npm publish --workspace @covas/<package-name>
```

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Refactor
- `test:` Tests
- `chore:` Maintenance

## Reporting Issues

- Use the [Bug Report template](./.github/ISSUE_TEMPLATE.md)
- Include environment details and reproduction steps
- Screenshots or GIFs are extremely helpful for UI issues

## Questions?

Open an issue or start a discussion. We aim to respond within a few days.
