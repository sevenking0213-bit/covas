import type { WorkspaceAnnotation } from '@covas/shared-types';
import { pushHistoryState, redoHistoryState, undoHistoryState } from './history';
import type { WorkspaceState } from './workspaceState';

export type WorkspaceAction =
  | { type: 'set-active-image'; imageId: string | null }
  | { type: 'set-prompt-draft'; value: string }
  | { type: 'commit-annotations'; imageId: string; annotations: WorkspaceAnnotation[] }
  | { type: 'undo'; imageId: string }
  | { type: 'redo'; imageId: string }
  | { type: 'clear-annotations'; imageId: string };

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  if (action.type === 'set-active-image') {
    return { ...state, activeImageId: action.imageId };
  }

  if (action.type === 'set-prompt-draft') {
    return { ...state, promptDraft: action.value };
  }

  if (action.type === 'commit-annotations') {
    const nextHistory = pushHistoryState(state.historyByImageId[action.imageId], action.annotations);

    return {
      ...state,
      annotationsByImageId: { ...state.annotationsByImageId, [action.imageId]: action.annotations },
      historyByImageId: { ...state.historyByImageId, [action.imageId]: nextHistory },
    };
  }

  if (action.type === 'undo') {
    const nextHistory = undoHistoryState(state.historyByImageId[action.imageId]);

    return {
      ...state,
      annotationsByImageId: { ...state.annotationsByImageId, [action.imageId]: nextHistory.present },
      historyByImageId: { ...state.historyByImageId, [action.imageId]: nextHistory },
    };
  }

  if (action.type === 'redo') {
    const nextHistory = redoHistoryState(state.historyByImageId[action.imageId]);

    return {
      ...state,
      annotationsByImageId: { ...state.annotationsByImageId, [action.imageId]: nextHistory.present },
      historyByImageId: { ...state.historyByImageId, [action.imageId]: nextHistory },
    };
  }

  const nextHistory = pushHistoryState(state.historyByImageId[action.imageId], []);

  return {
    ...state,
    annotationsByImageId: { ...state.annotationsByImageId, [action.imageId]: [] },
    historyByImageId: { ...state.historyByImageId, [action.imageId]: nextHistory },
  };
}
