import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvagentWorkspace } from '@covas/workspace';
import type { WorkspaceAnnotation } from '@covas/shared-types';
import { AnnotationStage } from '../../packages/workspace/src/components/AnnotationStage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  globalThis.Image = OriginalImage;
});

const OriginalImage = globalThis.Image;

describe('AnnotationStage', () => {
  it('matches the FirstClaw default entry state', () => {
    render(
      <CanvagentWorkspace
        input={{ images: [{ id: 'img-1', src: '/one.png', title: 'Original' }] }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Pan' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('slider', { name: /line width/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('shows every MVP tool in the toolbar', () => {
    render(
      <CanvagentWorkspace
        input={{ images: [{ id: 'img-1', src: '/one.png', title: 'Original' }] }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Pan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Brush' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ellipse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arrow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Text' })).toBeInTheDocument();
  });

  it('renders the active style panel inside the toolbar anchor so it keeps a fixed left alignment', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CanvagentWorkspace
        input={{ images: [{ id: 'img-1', src: '/one.png', title: 'Original' }] }}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Text' }));

    const toolbarAnchor = container.querySelector('.canvagent-workspace-toolbar-anchor');
    const stylePanelAnchor = container.querySelector('.canvagent-stage-style-panel-anchor');

    expect(toolbarAnchor).not.toBeNull();
    expect(stylePanelAnchor).not.toBeNull();
    expect(toolbarAnchor?.contains(stylePanelAnchor as Node)).toBe(true);
  });

  it('commits a text annotation through the inline editor flow', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CanvagentWorkspace
        input={{ images: [{ id: 'img-1', src: '/one.png', title: 'Original' }] }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Text' }));
    await user.click(screen.getByLabelText(/annotation stage/i));
    await user.type(screen.getByRole('textbox', { name: /annotation text/i }), 'Move the logo');
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    await user.type(screen.getByRole('textbox', { name: /message draft/i }), 'Move the logo');
    await user.click(screen.getByRole('button', { name: /submit annotations/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].structuredResult.annotations[0]?.type).toBe('text');
  });

  it('shows a stroke style panel for a selected rectangle annotation', async () => {
    const user = userEvent.setup();
    const onCommitAnnotations = vi.fn();
    const annotations: WorkspaceAnnotation[] = [
      {
        id: 'rect-1',
        type: 'rect',
        geometry: { x: 160, y: 120, width: 220, height: 180 },
        style: { stroke: '#2563eb', strokeWidth: 6 },
      },
    ];

    render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={annotations}
        tool="rectangle"
        hasExplicitToolSelection
        onCommitAnnotations={onCommitAnnotations}
      />,
    );

    await user.click(screen.getByRole('button', { name: /select annotation rect-1/i }));

    expect(screen.getByRole('slider', { name: /line width/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /annotation color #2563eb/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /annotation color #ef4444/i }));

    expect(onCommitAnnotations).not.toHaveBeenCalled();
  });

  it('uses a popover font-size picker for text styles instead of a native select', async () => {
    const user = userEvent.setup();

    render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={[]}
        tool="text"
        hasExplicitToolSelection
        onCommitAnnotations={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /font size/i });
    expect(trigger).toHaveTextContent('32');
    expect(screen.queryByRole('combobox', { name: /font size/i })).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: '40' }));

    expect(trigger).toHaveTextContent('40');
    expect(screen.queryByRole('button', { name: '40' })).not.toBeInTheDocument();
  });

  it('renders resize handles when a rectangle annotation is selected in edit mode', async () => {
    const user = userEvent.setup();
    const annotations: WorkspaceAnnotation[] = [
      {
        id: 'rect-1',
        type: 'rect',
        geometry: { x: 160, y: 120, width: 220, height: 180 },
        style: { stroke: '#2563eb', strokeWidth: 6 },
      },
    ];

    render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={annotations}
        tool="rectangle"
        onCommitAnnotations={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /select annotation rect-1/i }));

    expect(screen.getAllByRole('button', { name: /resize /i })).toHaveLength(8);
  });

  it('resizes a selected rectangle when dragging a resize handle in edit mode', async () => {
    const user = userEvent.setup();
    const onCommitAnnotations = vi.fn();
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 960,
      bottom: 540,
      width: 960,
      height: 540,
      toJSON: () => ({}),
    } as DOMRect));
    globalThis.Image = class MockImage {
      onload: null | (() => void) = null;
      naturalWidth = 900;
      naturalHeight = 1200;
      width = 900;
      height = 1200;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    } as unknown as typeof Image;
    const annotations: WorkspaceAnnotation[] = [
      {
        id: 'rect-1',
        type: 'rect',
        geometry: { x: 160, y: 120, width: 220, height: 180 },
        style: { stroke: '#2563eb', strokeWidth: 6 },
      },
    ];

    render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={annotations}
        tool="rectangle"
        onCommitAnnotations={onCommitAnnotations}
      />,
    );

    await user.click(screen.getByRole('button', { name: /select annotation rect-1/i }));

    const stage = screen.getByLabelText(/annotation stage/i);
    const handle = screen.getByRole('button', { name: /resize bottom-right/i });

    fireEvent.mouseDown(handle, { clientX: 592, clientY: 352 });
    fireEvent.mouseMove(stage, { clientX: 700, clientY: 460 });
    fireEvent.mouseUp(stage, { clientX: 700, clientY: 460 });

    expect(onCommitAnnotations).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'rect-1',
        type: 'rect',
        geometry: expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number),
        }),
      }),
    ]);

    const committed = onCommitAnnotations.mock.calls.at(-1)?.[0]?.[0];
    expect(committed?.geometry.width).toBeGreaterThan(220);
    expect(committed?.geometry.height).toBeGreaterThan(180);

    rectSpy.mockRestore();
    globalThis.Image = OriginalImage;
  });

  it('deletes the selected annotation with the Delete key', async () => {
    const user = userEvent.setup();
    const onCommitAnnotations = vi.fn();
    const annotations: WorkspaceAnnotation[] = [
      {
        id: 'rect-1',
        type: 'rect',
        geometry: { x: 160, y: 120, width: 220, height: 180 },
        style: { stroke: '#2563eb', strokeWidth: 6 },
      },
    ];

    render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={annotations}
        tool="rectangle"
        onCommitAnnotations={onCommitAnnotations}
      />,
    );

    await user.click(screen.getByRole('button', { name: /select annotation rect-1/i }));
    await user.keyboard('{Delete}');

    expect(onCommitAnnotations).toHaveBeenCalledWith([]);
  });

  it('does not show selected visual state when clicking an annotation in pan mode', async () => {
    const user = userEvent.setup();
    const annotations: WorkspaceAnnotation[] = [
      {
        id: 'rect-1',
        type: 'rect',
        geometry: { x: 160, y: 120, width: 220, height: 180 },
        style: { stroke: '#2563eb', strokeWidth: 6 },
      },
    ];

    render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={annotations}
        tool="pan"
        onCommitAnnotations={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /select annotation rect-1/i }));

    expect(screen.getByRole('button', { name: /select annotation rect-1/i })).not.toHaveClass('is-selected');
    expect(screen.queryByRole('slider', { name: /line width/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resize /i })).not.toBeInTheDocument();
  });

  it('removes an existing text annotation when its editor is cleared', async () => {
    const user = userEvent.setup();
    const onCommitAnnotations = vi.fn();
    const annotations: WorkspaceAnnotation[] = [
      {
        id: 'text-1',
        type: 'text',
        geometry: { x: 200, y: 160 },
        text: 'Original copy',
        style: { color: '#1d4ed8', fontSize: 32, fill: '#ffffff', fillEnabled: false },
      },
    ];

    render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={annotations}
        tool="text"
        hasExplicitToolSelection
        onCommitAnnotations={onCommitAnnotations}
      />,
    );

    await user.dblClick(screen.getByRole('button', { name: /select annotation text-1/i }));
    await user.clear(screen.getByRole('textbox', { name: /annotation text/i }));
    await user.tab();

    expect(onCommitAnnotations).toHaveBeenCalledWith([]);
  });

  it('does not open the text editor when double-clicking text in pan mode', async () => {
    const user = userEvent.setup();
    const annotations: WorkspaceAnnotation[] = [
      {
        id: 'text-1',
        type: 'text',
        geometry: { x: 200, y: 160 },
        text: 'Original copy',
        style: { color: '#1d4ed8', fontSize: 32, fill: '#ffffff', fillEnabled: false },
      },
    ];

    render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={annotations}
        tool="pan"
        onCommitAnnotations={vi.fn()}
      />,
    );

    await user.dblClick(screen.getByRole('button', { name: /select annotation text-1/i }));

    expect(screen.queryByRole('textbox', { name: /annotation text/i })).not.toBeInTheDocument();
  });

  it('commits text on outside click without spawning a new editor', async () => {
    const user = userEvent.setup();
    const onCommitAnnotations = vi.fn();

    render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={[]}
        tool="text"
        hasExplicitToolSelection
        onCommitAnnotations={onCommitAnnotations}
      />,
    );

    await user.click(screen.getByLabelText(/annotation stage/i));
    await user.type(screen.getByRole('textbox', { name: /annotation text/i }), 'Outside commit');
    await user.click(screen.getByLabelText(/annotation stage/i));

    expect(onCommitAnnotations).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'text',
        text: 'Outside commit',
      }),
    ]);
    expect(screen.queryByRole('textbox', { name: /annotation text/i })).not.toBeInTheDocument();
  });

  it('opens a text editor when the pointer lands anywhere inside the stage canvas', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 960,
      bottom: 540,
      width: 960,
      height: 540,
      toJSON: () => ({}),
    } as DOMRect));

    globalThis.Image = class MockImage {
      onload: null | (() => void) = null;
      naturalWidth = 900;
      naturalHeight = 1200;
      width = 900;
      height = 1200;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    } as unknown as typeof Image;

    render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={[]}
        tool="text"
        hasExplicitToolSelection
        onCommitAnnotations={vi.fn()}
      />,
    );

    const stage = screen.getByLabelText(/annotation stage/i);

    fireEvent.mouseDown(stage, { clientX: 36, clientY: 36 });
    fireEvent.mouseUp(stage, { clientX: 36, clientY: 36 });
    expect(screen.getByRole('textbox', { name: /annotation text/i })).toBeInTheDocument();
  });

  it('keeps committed text selectable while the text tool stays active', async () => {
    const user = userEvent.setup();

    render(
      <CanvagentWorkspace
        input={{ images: [{ id: 'img-1', src: '/one.png', title: 'Original' }] }}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Text' }));
    await user.click(screen.getByLabelText(/annotation stage/i));
    await user.type(screen.getByRole('textbox', { name: /annotation text/i }), 'Primary note');
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    await user.click(screen.getByRole('button', { name: /select annotation text-/i }));

    expect(screen.getByRole('button', { name: /select annotation text-/i })).toHaveClass('is-selected');
  });

  it('can create a second text annotation after committing the first one', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CanvagentWorkspace
        input={{ images: [{ id: 'img-1', src: '/one.png', title: 'Original' }] }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Text' }));
    await user.click(screen.getByLabelText(/annotation stage/i));
    await user.type(screen.getByRole('textbox', { name: /annotation text/i }), 'First note');
    await user.keyboard('{Meta>}{Enter}{/Meta}');

    await user.click(screen.getByLabelText(/annotation stage/i));
    await user.type(screen.getByRole('textbox', { name: /annotation text/i }), 'Second note');
    await user.keyboard('{Meta>}{Enter}{/Meta}');

    await user.type(screen.getByRole('textbox', { name: /message draft/i }), 'Two notes');
    await user.click(screen.getByRole('button', { name: /submit annotations/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].structuredResult.annotations).toEqual([
      expect.objectContaining({ type: 'text', text: 'First note' }),
      expect.objectContaining({ type: 'text', text: 'Second note' }),
    ]);
  });

  it('clears selected annotation when switching to pan mode and keeps it cleared after switching away', async () => {
    const user = userEvent.setup();
    const annotations: WorkspaceAnnotation[] = [
      {
        id: 'text-1',
        type: 'text',
        geometry: { x: 200, y: 160 },
        text: 'Original copy',
        style: { color: '#1d4ed8', fontSize: 32, fill: '#ffffff', fillEnabled: false },
      },
    ];

    const { rerender } = render(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={annotations}
        tool="text"
        hasExplicitToolSelection
        onCommitAnnotations={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /select annotation text-1/i }));
    expect(screen.getByRole('button', { name: /select annotation text-1/i })).toHaveClass('is-selected');

    rerender(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={annotations}
        tool="pan"
        hasExplicitToolSelection
        onCommitAnnotations={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /select annotation text-1/i })).not.toHaveClass('is-selected');

    rerender(
      <AnnotationStage
        image={{ id: 'img-1', src: '/one.png', title: 'Original' }}
        annotations={annotations}
        tool="rectangle"
        hasExplicitToolSelection
        onCommitAnnotations={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /select annotation text-1/i })).not.toHaveClass('is-selected');
  });
});
