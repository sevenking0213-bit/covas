import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { persistCodexSessionState } from '@covas/adapter-codex';
import { readSessionManifest, readWorkspaceState, writeSessionManifest } from '@covas/session-store';
import type { CanvagentSessionManifest } from '@covas/shared-types';

function createManifest(): CanvagentSessionManifest {
  return {
    sessionId: 'thread-123',
    activePageId: 'page-main',
    activeImageId: 'img-1',
    imageOrder: ['img-1', 'img-2'],
    imagesById: {
      'img-1': {
        id: 'img-1',
        kind: 'original',
        fileName: 'source.png',
        assetPath: '/tmp/project/canvas/sessions/thread-123/pages/page-main/assets/source.png',
        thumbnailPath: '/tmp/project/canvas/sessions/thread-123/pages/page-main/thumbnails/source.png',
        createdAt: '2026-07-23T08:00:00.000Z',
        parentImageId: null,
      },
      'img-2': {
        id: 'img-2',
        kind: 'generated',
        fileName: 'variant.png',
        assetPath: '/tmp/project/canvas/sessions/thread-123/pages/page-main/assets/variant.png',
        thumbnailPath: '/tmp/project/canvas/sessions/thread-123/pages/page-main/thumbnails/variant.png',
        createdAt: '2026-07-23T08:02:00.000Z',
        parentImageId: 'img-1',
      },
    },
    pages: [{ id: 'page-main', title: 'Main page' }],
    pageStateById: {
      'page-main': {
        pageId: 'page-main',
        activeImageId: 'img-1',
        promptDraft: 'Keep the main subject.',
      },
    },
  };
}

describe('persistCodexSessionState', () => {
  it('writes the merged workspace session state back to the session manifest', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvagent-codex-persist-'));
    const manifest = createManifest();
    await writeSessionManifest(projectDir, manifest);

    const nextManifest = await persistCodexSessionState({
      projectDir,
      manifest,
      state: {
        activeImageId: 'img-2',
        promptDraft: 'Raise the badge and reduce the padding.',
      },
    });

    expect(nextManifest.pageStateById?.['page-main']).toEqual({
      pageId: 'page-main',
      activeImageId: 'img-2',
      promptDraft: 'Raise the badge and reduce the padding.',
    });

    await expect(readSessionManifest(projectDir, manifest.sessionId)).resolves.toMatchObject({
      activeImageId: 'img-2',
      pageStateById: {
        'page-main': {
          activeImageId: 'img-2',
          promptDraft: 'Raise the badge and reduce the padding.',
        },
      },
    });
    await expect(readWorkspaceState(projectDir)).resolves.toMatchObject({
      version: 1,
      lastSessionId: 'thread-123',
      activePageId: 'page-main',
      activeImageId: 'img-2',
      promptDraft: 'Raise the badge and reduce the padding.',
    });
  });
});
