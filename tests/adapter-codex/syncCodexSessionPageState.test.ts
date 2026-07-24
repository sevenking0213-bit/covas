import { describe, expect, it } from 'vitest';
import { syncCodexSessionPageState } from '@covas/adapter-codex';
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

describe('syncCodexSessionPageState', () => {
  it('merges workspace session state back into the active page manifest', () => {
    const nextManifest = syncCodexSessionPageState({
      manifest: createManifest(),
      state: {
        activeImageId: 'img-2',
        promptDraft: 'Shift the badge upward and tighten the crop.',
      },
    });

    expect(nextManifest.activeImageId).toBe('img-2');
    expect(nextManifest.pageStateById?.['page-main']).toEqual({
      pageId: 'page-main',
      activeImageId: 'img-2',
      promptDraft: 'Shift the badge upward and tighten the crop.',
    });
    expect(nextManifest.imageOrder).toEqual(['img-1', 'img-2']);
  });
});
