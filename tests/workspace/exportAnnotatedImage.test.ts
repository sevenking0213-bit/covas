import { describe, expect, it } from 'vitest';
import { exportAnnotatedImage } from '@covas/workspace';

describe('exportAnnotatedImage', () => {
  it('returns an annotated-image attachment with a png data url', async () => {
    const attachment = await exportAnnotatedImage({
      imageSrc: 'data:image/png;base64,AAA=',
      imageId: 'img-1',
      annotations: [
        {
          id: 'rect-1',
          type: 'rect',
          geometry: { x: 12, y: 20, width: 120, height: 80 },
          style: { stroke: '#2563eb', strokeWidth: 6 },
        },
      ],
    });

    expect(attachment.kind).toBe('annotated-image');
    expect(attachment.mimeType).toBe('image/png');
    expect(attachment.dataUrl?.startsWith('data:image/png;base64,')).toBe(true);
  });
});
