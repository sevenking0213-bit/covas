import { describe, expect, it } from 'vitest';
import { buildSubmitPayload } from '@covas/bridge';

describe('buildSubmitPayload', () => {
  it('packages attachment, draft, and structured result', () => {
    const payload = buildSubmitPayload({
      imageId: 'img-1',
      annotations: [
        {
          id: 'annotation-1',
          type: 'rect',
          geometry: { x: 1, y: 2, width: 30, height: 40 },
          style: { stroke: '#2563eb', strokeWidth: 6 },
        },
      ],
      messageDraft: 'Please move the title up.',
      attachment: {
        id: 'attachment-1',
        kind: 'annotated-image',
        mimeType: 'image/png',
        name: 'annotated-image.png',
        dataUrl: 'data:image/png;base64,AAA=',
      },
    });

    expect(payload.messageDraft).toBe('Please move the title up.');
    expect(payload.attachments).toHaveLength(1);
    expect(payload.structuredResult.imageId).toBe('img-1');
    expect(payload.structuredResult.annotations[0]?.type).toBe('rect');
  });

  it('carries session-scoped submit metadata when provided', () => {
    const payload = buildSubmitPayload({
      imageId: 'img-2',
      sessionId: 'thread-123',
      pageId: 'page-main',
      sessionImageId: 'img-2',
      annotations: [],
      messageDraft: 'Tighten the crop and raise the badge.',
    });

    expect(payload.sessionId).toBe('thread-123');
    expect(payload.pageId).toBe('page-main');
    expect(payload.activeImageId).toBe('img-2');
    expect(payload.structuredResult.sessionImageId).toBe('img-2');
  });
});
