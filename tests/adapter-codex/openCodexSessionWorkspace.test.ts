import { describe, expect, it } from 'vitest';
import {
  buildCodexWidgetRenderResult,
  buildCodexSubmitResult,
  insertCodexSessionImage,
  openCodexSessionWorkspace,
} from '@covas/adapter-codex';
import type { CanvagentSessionManifest, SubmitPayload } from '@covas/shared-types';

function createManifest(): CanvagentSessionManifest {
  return {
    sessionId: 'thread-123',
    activePageId: 'page-main',
    activeImageId: 'img-2',
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
        activeImageId: 'img-2',
        promptDraft: 'Tighten the crop around the subject.',
      },
    },
  };
}

describe('adapter-codex', () => {
  it('opens a workspace input from a session manifest', () => {
    const manifest = createManifest();

    const workspaceInput = openCodexSessionWorkspace({
      projectDir: '/tmp/project',
      sessionId: manifest.sessionId,
      manifest,
    });

    expect(workspaceInput.activeImageId).toBe('img-2');
    expect(workspaceInput.context?.sessionId).toBe('thread-123');
    expect(workspaceInput.context?.pageId).toBe('page-main');
    expect(workspaceInput.context?.prompt).toBe('Tighten the crop around the subject.');
    expect(workspaceInput.images.map((image) => image.id)).toEqual(['img-1', 'img-2']);
    expect(workspaceInput.images[1]).toMatchObject({
      id: 'img-2',
      src: '/tmp/project/canvas/sessions/thread-123/pages/page-main/assets/variant.png',
      thumbnailSrc: '/tmp/project/canvas/sessions/thread-123/pages/page-main/thumbnails/variant.png',
      sessionImageId: 'img-2',
      parentImageId: 'img-1',
    });
  });

  it('inserts a new generated image into the session manifest history', () => {
    const manifest = createManifest();

    const nextManifest = insertCodexSessionImage({
      manifest,
      image: {
        id: 'img-3',
        kind: 'edited',
        fileName: 'edited.png',
        assetPath: '/tmp/project/canvas/sessions/thread-123/pages/page-main/assets/edited.png',
        thumbnailPath: '/tmp/project/canvas/sessions/thread-123/pages/page-main/thumbnails/edited.png',
        createdAt: '2026-07-23T08:05:00.000Z',
        parentImageId: 'img-2',
      },
    });

    expect(nextManifest.activeImageId).toBe('img-3');
    expect(nextManifest.imageOrder).toEqual(['img-1', 'img-2', 'img-3']);
    expect(nextManifest.imagesById['img-3']?.parentImageId).toBe('img-2');
    expect(nextManifest.pageStateById?.['page-main']?.activeImageId).toBe('img-3');
  });

  it('builds a codex-aware submit result from the workspace payload', () => {
    const payload: SubmitPayload = {
      attachments: [{ id: 'attachment-1', kind: 'annotated-image', mimeType: 'image/png', name: 'annotated.png' }],
      messageDraft: 'Move the badge upward.',
      structuredResult: {
        imageId: 'img-2',
        annotations: [],
        createdAt: 1_753_215_000_000,
      },
    };

    const result = buildCodexSubmitResult({
      sessionId: 'thread-123',
      pageId: 'page-main',
      activeImageId: 'img-2',
      payload,
    });

    expect(result.sessionId).toBe('thread-123');
    expect(result.pageId).toBe('page-main');
    expect(result.activeImageId).toBe('img-2');
    expect(result.structuredResult.sessionImageId).toBe('img-2');
    expect(result.messageDraft).toBe('Move the badge upward.');
  });

  it('builds a native-widget render result for the Codex host', () => {
    const manifest = createManifest();

    const result = buildCodexWidgetRenderResult({
      outputTemplateUri: 'ui://widget/canvagent/codex-widget.html',
      staticDir: '/tmp/project/apps/codex-widget/dist',
      projectDir: '/tmp/project',
      preferredDisplayMode: 'inline',
      bootstrap: {
        manifest,
        title: 'Canvagent for Codex',
        subtitle: 'Annotate and send the next revision back into the current task.',
        statusText: 'Ready for the next handoff.',
      },
    });

    expect(result.structuredContent).toMatchObject({
      version: 1,
      widget: 'canvagent-codex-widget',
      title: 'Canvagent for Codex',
      rendering: 'native-widget',
      staticDir: '/tmp/project/apps/codex-widget/dist',
      projectDir: '/tmp/project',
      preferredDisplayMode: 'inline',
      bootstrap: {
        manifest: {
          sessionId: 'thread-123',
        },
      },
    });
    expect(result._meta).toMatchObject({
      'openai/outputTemplate': 'ui://widget/canvagent/codex-widget.html',
      widgetData: {
        staticDir: '/tmp/project/apps/codex-widget/dist',
        projectDir: '/tmp/project',
        preferredDisplayMode: 'inline',
        bootstrap: {
          manifest: {
            sessionId: 'thread-123',
          },
        },
      },
    });
  });
});
