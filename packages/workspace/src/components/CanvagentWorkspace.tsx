import { useEffect, useMemo, useReducer, useState } from 'react';
import { buildSubmitPayload } from '@covas/bridge';
import type { OpenWorkspaceInput, SubmitPayload } from '@covas/shared-types';
import { exportAnnotatedImage } from '../exportAnnotatedImage';
import { workspaceReducer } from '../state/workspaceReducer';
import { createInitialWorkspaceState, type WorkspaceSessionState } from '../state/workspaceState';
import { AnnotationStage } from './AnnotationStage';
import { PromptComposer } from './PromptComposer';
import { ThumbnailStrip } from './ThumbnailStrip';
import { Toolbar, type AnnotationTool } from './Toolbar';
import '../styles.css';

export type CanvagentWorkspaceProps = {
  input: OpenWorkspaceInput;
  onSubmit: (payload: SubmitPayload) => void | Promise<void>;
  onSessionStateChange?: (state: WorkspaceSessionState) => void;
  onImportLocalImage?: (file: File) => void | Promise<void>;
  onCancel?: () => void;
  busy?: boolean;
};

export function CanvagentWorkspace(props: CanvagentWorkspaceProps) {
  const initialState = useMemo(() => createInitialWorkspaceState(props.input), [props.input]);
  const [state, dispatch] = useReducer(workspaceReducer, initialState);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pan');
  const [hasExplicitToolSelection, setHasExplicitToolSelection] = useState(false);
  const [stylePanelHost, setStylePanelHost] = useState<HTMLDivElement | null>(null);
  const activeImage = props.input.images.find((image) => image.id === state.activeImageId) ?? props.input.images[0] ?? null;
  const activeAnnotations = state.activeImageId ? (state.annotationsByImageId[state.activeImageId] ?? []) : [];
  const activeHistory = state.activeImageId ? state.historyByImageId[state.activeImageId] : undefined;

  useEffect(() => {
    props.onSessionStateChange?.({
      activeImageId: state.activeImageId,
      promptDraft: state.promptDraft,
    });
  }, [props, state.activeImageId, state.promptDraft]);

  const handleSelectImage = (imageId: string) => {
    dispatch({ type: 'set-active-image', imageId });
    setActiveTool('pan');
    setHasExplicitToolSelection(false);
  };

  const handleSubmit = async () => {
    if (!activeImage || !state.activeImageId) {
      return;
    }

    const annotations = state.annotationsByImageId[state.activeImageId] ?? [];
    const attachment = await exportAnnotatedImage({
      imageSrc: activeImage.src,
      imageId: state.activeImageId,
      annotations,
    });
    const payload = buildSubmitPayload({
      imageId: state.activeImageId,
      sessionId: props.input.context?.sessionId,
      pageId: props.input.context?.pageId,
      sessionImageId: activeImage.sessionImageId ?? state.activeImageId,
      annotations,
      messageDraft: state.promptDraft,
      attachment,
    });

    await props.onSubmit(payload);
  };

  return (
    <div className="canvagent-workspace-shell">
      <h1 className="sr-only">{activeImage?.title ?? activeImage?.id ?? 'Canvagent workspace'}</h1>
      <main className="canvagent-workspace-main">
        <div className="canvagent-workspace-toolbar-anchor">
          <div className="canvagent-workspace-floating-tools">
            <Toolbar
              activeTool={activeTool}
              hasExplicitToolSelection={hasExplicitToolSelection}
              canUndo={(activeHistory?.past.length ?? 0) > 0}
              canRedo={(activeHistory?.future.length ?? 0) > 0}
              canClear={activeAnnotations.length > 0}
              onSelectTool={(tool) => {
                setActiveTool(tool);
                setHasExplicitToolSelection(true);
              }}
              onUndo={() => {
                if (state.activeImageId) {
                  dispatch({ type: 'undo', imageId: state.activeImageId });
                }
              }}
              onRedo={() => {
                if (state.activeImageId) {
                  dispatch({ type: 'redo', imageId: state.activeImageId });
                }
              }}
              onClear={() => {
                if (state.activeImageId) {
                  dispatch({ type: 'clear-annotations', imageId: state.activeImageId });
                }
              }}
              onImportLocalImage={props.onImportLocalImage}
            />
            <div className="canvagent-workspace-style-panel-host" ref={setStylePanelHost} />
          </div>
        </div>
        {activeImage && state.activeImageId ? (
          <AnnotationStage
            image={activeImage}
            annotations={activeAnnotations}
            tool={activeTool}
            hasExplicitToolSelection={hasExplicitToolSelection}
            stylePanelHost={stylePanelHost}
            onCommitAnnotations={(annotations) =>
              dispatch({ type: 'commit-annotations', imageId: state.activeImageId!, annotations })}
          />
        ) : (
          <div className="canvagent-workspace-empty-state">
            <p>Import a local image to start annotating.</p>
          </div>
        )}
      </main>
      <div className="canvagent-workspace-bottom-panel">
        <ThumbnailStrip
          images={props.input.images}
          activeImageId={state.activeImageId}
          annotationsByImageId={state.annotationsByImageId}
          onSelectImage={handleSelectImage}
        />
        <PromptComposer
          value={state.promptDraft}
          busy={props.busy || !activeImage || !state.activeImageId}
          onChange={(value) => dispatch({ type: 'set-prompt-draft', value })}
          onSubmit={() => {
            void handleSubmit();
          }}
        />
      </div>
    </div>
  );
}
