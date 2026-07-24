import { describe, expect, it } from 'vitest';
import type { OpenWorkspaceInput, WorkspaceAnnotation } from '@covas/shared-types';
import { createInitialWorkspaceState, workspaceReducer } from '@covas/workspace';

const input: OpenWorkspaceInput = {
  images: [
    { id: 'img-1', src: '/one.png', kind: 'original' },
    { id: 'img-2', src: '/two.png', kind: 'generated' },
  ],
};

const rectangle: WorkspaceAnnotation = {
  id: 'rect-1',
  type: 'rect',
  geometry: { x: 10, y: 10, width: 100, height: 80 },
  style: { stroke: '#2563eb', strokeWidth: 6 },
};

describe('workspaceReducer', () => {
  it('switches the active image without losing existing annotations', () => {
    const initial = createInitialWorkspaceState(input);
    const withRect = workspaceReducer(initial, { type: 'commit-annotations', imageId: 'img-1', annotations: [rectangle] });
    const switched = workspaceReducer(withRect, { type: 'set-active-image', imageId: 'img-2' });

    expect(switched.activeImageId).toBe('img-2');
    expect(switched.annotationsByImageId['img-1']).toEqual([rectangle]);
  });

  it('supports undo and redo per image', () => {
    const initial = createInitialWorkspaceState(input);
    const withRect = workspaceReducer(initial, { type: 'commit-annotations', imageId: 'img-1', annotations: [rectangle] });
    const undone = workspaceReducer(withRect, { type: 'undo', imageId: 'img-1' });
    const redone = workspaceReducer(undone, { type: 'redo', imageId: 'img-1' });

    expect(undone.annotationsByImageId['img-1']).toEqual([]);
    expect(redone.annotationsByImageId['img-1']).toEqual([rectangle]);
  });

  it('keeps the thumbnail strip as navigation only by storing one active image id', () => {
    const initial = createInitialWorkspaceState(input);

    expect(initial.activeImageId).toBe('img-1');
    expect(Object.keys(initial.annotationsByImageId)).toEqual(['img-1', 'img-2']);
  });
});
