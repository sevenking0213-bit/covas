import type { OpenWorkspaceInput, WorkspaceAnnotation } from '@covas/shared-types';
import { normalizeOpenInput } from '@covas/bridge';
import { createHistoryState, type HistoryState } from './history';

export type WorkspaceImageObject = {
  id: string;
  imageId: string;
  x: number;
  y: number;
  zIndex: number;
};

export type WorkspaceState = {
  activeImageId: string | null;
  promptDraft: string;
  annotationsByImageId: Record<string, WorkspaceAnnotation[]>;
  historyByImageId: Record<string, HistoryState<WorkspaceAnnotation[]>>;
};

export type WorkspaceSessionState = Pick<WorkspaceState, 'activeImageId' | 'promptDraft'>;

export function createInitialWorkspaceState(input: OpenWorkspaceInput): WorkspaceState {
  const normalized = normalizeOpenInput(input);
  const annotationsByImageId = Object.fromEntries(
    normalized.images.map((image) => [image.id, [] as WorkspaceAnnotation[]]),
  );
  const historyByImageId = Object.fromEntries(
    normalized.images.map((image) => [image.id, createHistoryState<WorkspaceAnnotation[]>([])]),
  );

  return {
    activeImageId: normalized.activeImageId,
    promptDraft: normalized.context?.prompt ?? '',
    annotationsByImageId,
    historyByImageId,
  };
}
