import { describe, expect, it } from 'vitest';
import { createDraftAnnotation, createTextAnnotation, updateDraftAnnotation } from '@covas/workspace';

describe('drafting helpers', () => {
  it('creates a rectangle draft from the initial pointer point', () => {
    expect(createDraftAnnotation('rectangle', { x: 10, y: 12 }, { stroke: '#2563eb', strokeWidth: 6 })).toEqual({
      id: expect.any(String),
      type: 'rect',
      geometry: { x: 10, y: 12, width: 0, height: 0 },
      style: { stroke: '#2563eb', strokeWidth: 6 },
    });
  });

  it('updates arrow drafts using the drag start and current pointer', () => {
    const draft = createDraftAnnotation('arrow', { x: 10, y: 20 }, { stroke: '#2563eb', strokeWidth: 6 });

    expect(updateDraftAnnotation(draft, { x: 10, y: 20 }, { x: 90, y: 120 })).toEqual({
      ...draft,
      geometry: { points: [10, 20, 90, 120] },
    });
  });

  it('creates text annotations for committed text editor content', () => {
    expect(createTextAnnotation({
      id: 'text-1',
      x: 22,
      y: 40,
      text: 'Move this',
      color: '#1d4ed8',
      fontSize: 32,
      fill: '#ffffff',
      fillEnabled: false,
    })).toEqual({
      id: 'text-1',
      type: 'text',
      text: 'Move this',
      geometry: { x: 22, y: 40 },
      style: { color: '#1d4ed8', fontSize: 32, fill: '#ffffff', fillEnabled: false },
    });
  });
});
