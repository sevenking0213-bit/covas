export type AnnotationTool = 'pan' | 'brush' | 'rectangle' | 'ellipse' | 'arrow' | 'text';

type ToolbarProps = {
  activeTool: AnnotationTool;
  hasExplicitToolSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  canImportLocalImage?: boolean;
  onSelectTool: (tool: AnnotationTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onImportLocalImage?: (file: File) => void | Promise<void>;
};

const TOOLS: AnnotationTool[] = ['pan', 'brush', 'rectangle', 'ellipse', 'arrow', 'text'];

export function Toolbar(props: ToolbarProps) {
  return (
    <div className="canvagent-toolbar">
      {TOOLS.map((tool) => {
        const label = tool[0]!.toUpperCase() + tool.slice(1);
        const isActive = props.hasExplicitToolSelection && props.activeTool === tool;
        return (
          <button
            key={tool}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            onClick={() => props.onSelectTool(tool)}
          >
            <span className={`canvagent-toolbar-button-core ${isActive ? 'is-active' : ''}`}>
              <span className="canvagent-toolbar-icon" aria-hidden="true">{getToolGlyph(tool)}</span>
            </span>
          </button>
        );
      })}
      <span className="canvagent-toolbar-divider" aria-hidden="true" />
      <button
        type="button"
        aria-label="Undo"
        title="Undo"
        onClick={props.onUndo}
        disabled={!props.canUndo}
      >
        <span className="canvagent-toolbar-button-core is-action is-undo">
          <span className="canvagent-toolbar-icon" aria-hidden="true">{getActionGlyph('undo')}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo"
        onClick={props.onRedo}
        disabled={!props.canRedo}
      >
        <span className="canvagent-toolbar-button-core is-action is-redo">
          <span className="canvagent-toolbar-icon" aria-hidden="true">{getActionGlyph('redo')}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Clear"
        title="Clear"
        onClick={props.onClear}
        disabled={!props.canClear}
      >
        <span className="canvagent-toolbar-button-core is-action is-clear">
          <span className="canvagent-toolbar-icon" aria-hidden="true">{getActionGlyph('clear')}</span>
        </span>
      </button>
      <span className="canvagent-toolbar-divider" aria-hidden="true" />
      <label>
        <span className="sr-only">Local image file picker</span>
        <input
          type="file"
          accept="image/*"
          aria-label="Local image file picker"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              void props.onImportLocalImage?.(file);
            }
            event.currentTarget.value = '';
          }}
        />
        <span
          role="button"
          aria-label="Local image"
          title="Local image"
          aria-disabled={props.canImportLocalImage === false}
          className="canvagent-toolbar-import-button"
          tabIndex={props.canImportLocalImage === false ? -1 : 0}
        >
          <span className="canvagent-toolbar-button-core is-action">
            <span className="canvagent-toolbar-icon" aria-hidden="true">{getActionGlyph('image')}</span>
          </span>
        </span>
      </label>
    </div>
  );
}

type ImageContextToolbarProps = {
  imageTitle: string;
};

const IMAGE_CONTEXT_ACTIONS = [
  'Quick edit',
  'Zoom',
  'Remove background',
  'Erase',
  'Edit elements',
  'Edit text',
  'Move object',
] as const;

export function ImageContextToolbar(props: ImageContextToolbarProps) {
  return (
    <div className="canvagent-image-context-toolbar" role="toolbar" aria-label="Image object tools">
      <span className="canvagent-image-context-title" title={props.imageTitle}>{props.imageTitle}</span>
      <span className="canvagent-toolbar-divider" aria-hidden="true" />
      {IMAGE_CONTEXT_ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          aria-label={action}
          title={action}
          disabled={action !== 'Move object'}
        >
          <span className="canvagent-toolbar-button-core">
            <span className="canvagent-toolbar-icon" aria-hidden="true">{getImageContextGlyph(action)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function getToolGlyph(tool: AnnotationTool) {
  if (tool === 'pan') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M12 3.75v8.5m0-8.5c0-1.1.9-2 2-2s2 .9 2 2v6.5m-4-6.5c0-1.1-.9-2-2-2s-2 .9-2 2v8m4-8.5c0-1.1.9-2 2-2s2 .9 2 2v7.25m0 0V7.75c0-1.1.9-2 2-2s2 .9 2 2v5.96c0 4.37-2.94 7.62-7.19 7.62-3.48 0-6.31-2.83-6.31-6.31V9.5c0-1.1.9-2 2-2s2 .9 2 2v3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tool === 'brush') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M3 14.5c2.2-3.5 4.1-3.5 6.3 0s4.1 3.5 6.3 0 4.1-3.5 5.4-.1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tool === 'rectangle') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      </svg>
    );
  }

  if (tool === 'ellipse') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      </svg>
    );
  }

  if (tool === 'arrow') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M4 12h13m0 0-4.25-4.25M17 12l-4.25 4.25" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M7 5h10M12 5v14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function getActionGlyph(action: 'undo' | 'redo' | 'clear' | 'image') {
  if (action === 'undo') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M9 7 4.75 11.25 9 15.5M5 11.25h7.5a5.5 5.5 0 1 1 0 11h-1.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (action === 'redo') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="m15 7 4.25 4.25L15 15.5m4-4.25H11.5a5.5 5.5 0 1 0 0 11H13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (action === 'image') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <rect x="4.5" y="5" width="15" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="9" cy="10" r="1.5" fill="currentColor" />
        <path d="m7 16 3.5-3 2.75 2.25L15.5 13l2.5 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M9.5 9.5v7m5-7v7M5.5 6.5h13M10 4.5h4m-7 2 1 12.25a1.5 1.5 0 0 0 1.49 1.25h5.02A1.5 1.5 0 0 0 16 18.75L17 6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getImageContextGlyph(action: (typeof IMAGE_CONTEXT_ACTIONS)[number]) {
  if (action === 'Quick edit') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M12 5a7 7 0 1 0 7 7m0-7v4h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (action === 'Zoom') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M11 5v12m-6-6h12m4.5 8.5-4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (action === 'Remove background') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="4.5" y="4.5" width="15" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (action === 'Erase') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="m8 15 5.5-8.5a2 2 0 0 1 3.3-.08l2.7 4.08a2 2 0 0 1-.03 2.24L15 19.5a2 2 0 0 1-1.66.9H7.8a2 2 0 0 1-1.58-3.22L8 15Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }

  if (action === 'Edit elements') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M5 7.5h14M5 12h14M5 16.5h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (action === 'Edit text') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M7 5h10M12 5v14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M8 8h8v8H8z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 12h2m12 0h2m-8-8v2m0 12v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
