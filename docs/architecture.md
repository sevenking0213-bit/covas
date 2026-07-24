# Covas Architecture

## 1. Product Positioning

Covas is an agent-ready visual annotation workspace.

Its value is a smooth closed loop:

1. Import image results from chat or an agent host
2. Annotate inside a fixed, polished workspace UI
3. Submit the annotation result back as attachments, draft text, and structured data

The project is designed as a standalone open-source application-oriented monorepo.
Adapters (web, Codex, etc.) are pluggable — the architectural center is the **host-neutral bridge**, not any single host.

## 2. Core Scope

Covas has two primary capability areas:

1. **Konva-based annotation workspace** — the visual UI
2. **Optional host bridge** — open/submit lifecycle between workspace and runtime

What v1 intentionally does not do:

- No developer-customizable UI — one official workspace
- No graph-like node/link/version-tree editor
- No host-specific architecture
- No multi-user collaboration

## 3. User Workflow

1. Host passes one or more images into Covas via `openWorkspace()`
2. User selects one image to annotate
3. User marks the visual intent with annotation tools
4. Covas emits a submit payload: `{ attachments, messageDraft, structuredResult }`
5. Host consumes the payload and returns it into the chat/agent flow

## 4. Package Responsibilities

### `packages/workspace`
The official Covas visual workspace. Owns:
- Konva stage and all annotation interactions
- Bottom thumbnail strip navigation
- Export helpers

### `packages/bridge`
Host-neutral bridge between host and workspace. Owns:
- Open payload normalization
- Submit payload packaging
- No runtime-specific logic

### `packages/shared-types`
Public TypeScript contracts. Stable public API. Owns:
- `WorkspaceImage`, `WorkspaceAnnotation` types
- `OpenWorkspaceInput`, `SubmitPayload` types

### Adapters
Translate between host-specific runtime behavior and the bridge.

## 5. API Reference

### `openWorkspace(input)`

```ts
type WorkspaceImage = {
  id: string;
  src: string;
  kind?: 'original' | 'generated' | 'candidate' | 'reference';
  title?: string;
};

type OpenWorkspaceInput = {
  images: WorkspaceImage[];
  activeImageId?: string;
  context?: {
    taskId?: string;
    sessionId?: string;
    prompt?: string;
  };
};
```

### `onSubmit(payload)`

```ts
type SubmitPayload = {
  attachments: Array<{
    id: string;
    kind: 'annotated-image' | 'snapshot' | 'thumbnail';
    mimeType: string;
    name: string;
    dataUrl?: string;
  }>;
  messageDraft: string;
  structuredResult: {
    imageId: string;
    annotations: Array<{
      id: string;
      type: 'rect' | 'ellipse' | 'arrow' | 'brush' | 'highlight' | 'text';
      geometry: Record<string, unknown>;
      label?: string;
    }>;
    summary?: string;
    createdAt: number;
  };
};
```
