import { describe, expect, it } from 'vitest';
import type { WorkspaceAnnotation } from '@covas/shared-types';
import { getImageLayout, normalizeRect, serializeStructuredResult, translateAnnotation } from '@covas/workspace';

describe('annotation math', () => {
  it('fits an image into the padded stage area', () => {
    const layout = getImageLayout({
      containerWidth: 1000,
      containerHeight: 600,
      imageWidth: 1200,
      imageHeight: 800,
      padding: 24,
    });

    expect(layout.width).toBeLessThanOrEqual(952);
    expect(layout.height).toBeLessThanOrEqual(552);
    expect(layout.scale).toBeGreaterThan(0);
  });

  it('normalizes dragged rectangles regardless of drag direction', () => {
    expect(normalizeRect(100, 200, 40, 120)).toEqual({
      x: 40,
      y: 120,
      width: 60,
      height: 80,
    });
  });

  it('translates brush points and rectangle coordinates', () => {
    const brush: WorkspaceAnnotation = {
      id: 'brush-1',
      type: 'brush',
      geometry: { points: [0, 0, 10, 10] },
      style: { stroke: '#2563eb', strokeWidth: 16 },
    };
    const rect: WorkspaceAnnotation = {
      id: 'rect-1',
      type: 'rect',
      geometry: { x: 12, y: 18, width: 40, height: 60 },
      style: { stroke: '#2563eb', strokeWidth: 6 },
    };

    expect(translateAnnotation(brush, 5, 7)).toEqual({
      ...brush,
      geometry: { points: [5, 7, 15, 17] },
    });
    expect(translateAnnotation(rect, 5, 7)).toEqual({
      ...rect,
      geometry: { x: 17, y: 25, width: 40, height: 60 },
    });
  });

  it('serializes structured result with stable timestamps', () => {
    const annotations: WorkspaceAnnotation[] = [
      {
        id: 'text-1',
        type: 'text',
        text: 'Move this',
        geometry: { x: 10, y: 20 },
        style: { color: '#1d4ed8', fontSize: 32 },
      },
    ];

    const result = serializeStructuredResult('img-1', annotations, 'Move this');

    expect(result.imageId).toBe('img-1');
    expect(result.summary).toBe('Move this');
    expect(result.annotations).toEqual(annotations);
    expect(typeof result.createdAt).toBe('number');
  });
});
