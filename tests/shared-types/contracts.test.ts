import { describe, expect, it } from 'vitest';
import type {
  CanvagentSessionManifest,
  OpenCodexSessionWorkspaceInput,
  OpenWorkspaceInput,
  WorkspaceAnnotation,
  WorkspaceImage,
} from '@covas/shared-types';
import { normalizeOpenInput } from '@covas/bridge';

describe('shared contracts', () => {
  it('defaults the active image to the first image id', () => {
    const input: OpenWorkspaceInput = {
      images: [
        { id: 'img-1', src: '/one.png', kind: 'original' },
        { id: 'img-2', src: '/two.png', kind: 'generated' },
      ],
    };

    const normalized = normalizeOpenInput(input);

    expect(normalized.activeImageId).toBe('img-1');
  });

  it('keeps a stable annotation union for all MVP tools', () => {
    const images: WorkspaceImage[] = [{ id: 'img-1', src: '/one.png' }];
    const annotations: WorkspaceAnnotation[] = [
      {
        id: 'a1',
        type: 'rect',
        geometry: { x: 10, y: 20, width: 30, height: 40 },
        style: { stroke: '#2563eb', strokeWidth: 6 },
      },
      {
        id: 'a2',
        type: 'brush',
        geometry: { points: [0, 0, 10, 10] },
        style: { stroke: '#2563eb', strokeWidth: 16 },
      },
      {
        id: 'a3',
        type: 'text',
        geometry: { x: 12, y: 16 },
        text: 'note',
        style: { color: '#1d4ed8', fontSize: 32 },
      },
    ];

    expect(images).toHaveLength(1);
    expect(annotations.map((item) => item.type)).toEqual(['rect', 'brush', 'text']);
  });

  it('defines a session-scoped image history model', () => {
    const manifest: CanvagentSessionManifest = {
      sessionId: 'thread-123',
      activePageId: 'page-main',
      activeImageId: 'img-2',
      imageOrder: ['img-1', 'img-2'],
      imagesById: {
        'img-1': {
          id: 'img-1',
          kind: 'original',
          fileName: 'source.png',
          assetPath: 'canvas/sessions/thread-123/pages/page-main/assets/source.png',
          thumbnailPath: 'canvas/sessions/thread-123/pages/page-main/thumbnails/source.png',
          createdAt: '2026-07-23T08:00:00.000Z',
          parentImageId: null,
        },
        'img-2': {
          id: 'img-2',
          kind: 'generated',
          fileName: 'variant.png',
          assetPath: 'canvas/sessions/thread-123/pages/page-main/assets/variant.png',
          thumbnailPath: 'canvas/sessions/thread-123/pages/page-main/thumbnails/variant.png',
          createdAt: '2026-07-23T08:02:00.000Z',
          parentImageId: 'img-1',
        },
      },
      pages: [{ id: 'page-main', title: 'Main page' }],
    };

    const input: OpenCodexSessionWorkspaceInput = {
      projectDir: '/tmp/project',
      sessionId: 'thread-123',
      manifest,
    };

    expect(input.manifest.activeImageId).toBe('img-2');
    expect(input.manifest.imageOrder).toEqual(['img-1', 'img-2']);
  });
});
