# Covas

**Single-image visual annotation workspace for AI image iteration workflows.**

[![CI](https://github.com/your-org/covas/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/covas/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@covas/workspace.svg)](https://www.npmjs.com/package/@covas/workspace)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is Covas?

Covas is a polished, open-source annotation workbench for image iteration. Drop in images, annotate with boxes, arrows, text and brush strokes, then send the structured result back into your AI agent workflow.

It is built as a **host-neutral library** — the annotation workspace itself has no opinion about where it runs. Official adapters ship for web apps and Codex-style agents, and you can write your own adapter for any runtime.

## ✨ Features

- 🎯 **Single-image focused** — one annotation target at a time, zero cognitive overload
- 🛠️ **Annotation tools** — pan, brush, rectangle, ellipse, arrow, text
- 📎 **Smart export** — annotated image + message draft + structured JSON data in one payload
- 🔌 **Adapter model** — swap the runtime adapter without touching the annotation UI
- 📦 **Monorepo** — import only the packages you need
- 🔒 **TypeScript-first** — full type coverage, zero `any`

## Quick Start

### Use in your React app

```tsx
import { createWebWorkspaceSession } from '@covas/adapter-web';
import '@covas/workspace/styles.css';

const sessionTree = createWebWorkspaceSession({
  input: {
    images: [{ id: 'img-1', src: 'https://example.com/image.jpg' }],
    activeImageId: 'img-1',
    context: { prompt: 'Refine this image based on the annotations.' },
  },
  onSubmit: async (payload) => {
    console.log('messageDraft:', payload.messageDraft);
    console.log('attachments:', payload.attachments);
    console.log('annotations:', payload.structuredResult.annotations);
  },
});

return <div>{sessionTree}</div>;
```

### Local demo

```bash
git clone https://github.com/your-org/covas.git
cd covas
npm install
npm run dev:playground
```

Open [http://localhost:5173](http://localhost:5173) to try the playground.

## Packages

| Package | Description |
|---------|-------------|
| `@covas/workspace` | Core Konva-based annotation UI |
| `@covas/bridge` | Host-neutral open/submit lifecycle |
| `@covas/shared-types` | Public TypeScript contracts |
| `@covas/adapter-web` | React/web integration |
| `@covas/adapter-codex` | Codex agent adapter |
| `@covas/session-store` | Session persistence helpers |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Application                        │
├──────────────────┬──────────────────────────────────────────┤
│   Your Adapter   │  (@covas/adapter-web, adapter-codex…)   │
├──────────────────┴──────────────────────────────────────────┤
│                      @covas/bridge                           │
│         openWorkspace() · onSubmit(payload)                  │
├─────────────────────────────────────────────────────────────┤
│                    @covas/workspace                          │
│         Konva Stage · Tools · Export · Thumbnails            │
├─────────────────────────────────────────────────────────────┤
│                  @covas/shared-types                         │
│              WorkspaceImage · Annotation types                │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions welcome!
