import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvagentWorkspace } from '@covas/workspace';

const input = {
  images: [
    { id: 'img-1', src: '/one.png', title: 'Original', kind: 'original' as const },
    { id: 'img-2', src: '/two.png', title: 'Variation', kind: 'generated' as const },
  ],
  context: {
    prompt: 'Tighten the composition around the subject.',
  },
};

const OriginalImage = globalThis.Image;

function installImageLoadSpy() {
  const loads: string[] = [];

  class MockImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    crossOrigin = '';
    naturalWidth = 1;
    naturalHeight = 1;
    width = 1;
    height = 1;
    private currentSrc = '';

    get src() {
      return this.currentSrc;
    }

    set src(value: string) {
      this.currentSrc = value;
      loads.push(value);

      if (value.includes('/two')) {
        this.naturalWidth = 1200;
        this.naturalHeight = 900;
      } else {
        this.naturalWidth = 900;
        this.naturalHeight = 1200;
      }

      this.width = this.naturalWidth;
      this.height = this.naturalHeight;

      queueMicrotask(() => {
        this.onload?.();
      });
    }
  }

  globalThis.Image = MockImage as unknown as typeof Image;
  return loads;
}

afterEach(() => {
  cleanup();
  globalThis.Image = OriginalImage;
});

describe('CanvagentWorkspace', () => {
  it('renders only the active image inside the stage and uses thumbnails for switching', async () => {
    const user = userEvent.setup();

    render(<CanvagentWorkspace input={input} onSubmit={vi.fn()} />);

    expect(document.querySelector('[data-stage-world]')).not.toBeNull();
    expect(document.querySelectorAll('[data-stage-image-item]')).toHaveLength(1);
    expect(document.querySelector('.canvagent-stage-image-name')).toBeNull();
    expect(document.querySelector('[data-stage-image-item][data-image-id="img-2"]')).toBeNull();

    const thumbnailStrip = screen.getByLabelText(/image navigation/i);
    await user.click(within(thumbnailStrip).getByRole('button', { name: 'Variation' }));

    expect(document.querySelectorAll('[data-stage-image-item]')).toHaveLength(1);
    expect(document.querySelector('.canvagent-stage-image-name')).toBeNull();
    expect(document.querySelector('[data-stage-image-item][data-image-id="img-1"]')).toBeNull();
  });

  it('does not render the image context toolbar in the single-image workbench', () => {
    render(<CanvagentWorkspace input={input} onSubmit={vi.fn()} />);

    expect(screen.queryByRole('toolbar', { name: /image object tools/i })).not.toBeInTheDocument();
  });

  it('uses the single-image cleanup styles for the frame and zoom chip', () => {
    render(<CanvagentWorkspace input={input} onSubmit={vi.fn()} />);

    expect(document.querySelector('.canvagent-stage-image-frame.is-single-image')).not.toBeNull();
    expect(document.querySelector('.canvagent-stage-zoom-chip.is-single-image')).not.toBeNull();
  });

  it('does not reload the active image when switching tools', async () => {
    const loads = installImageLoadSpy();
    const user = userEvent.setup();

    render(
      <CanvagentWorkspace
        input={{ images: [{ id: 'img-1', src: '/one.png', title: 'Original', kind: 'original' as const }] }}
        onSubmit={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(loads).toEqual(['/one.png']);
    });

    await user.click(screen.getByRole('button', { name: 'Brush' }));
    await user.click(screen.getByRole('button', { name: 'Rectangle' }));
    await user.click(screen.getByRole('button', { name: 'Pan' }));

    await waitFor(() => {
      expect(loads).toEqual(['/one.png']);
    });
  });

  it('does not reload an already-visited image when switching thumbnails back and forth', async () => {
    const loads = installImageLoadSpy();
    const user = userEvent.setup();

    render(<CanvagentWorkspace input={input} onSubmit={vi.fn()} />);

    await waitFor(() => {
      expect(loads).toEqual(['/one.png']);
    });

    const thumbnailStrip = screen.getByLabelText(/image navigation/i);
    await user.click(within(thumbnailStrip).getByRole('button', { name: 'Variation' }));

    await waitFor(() => {
      expect(loads).toEqual(['/one.png', '/two.png']);
    });

    await user.click(within(thumbnailStrip).getByRole('button', { name: 'Original' }));

    await waitFor(() => {
      expect(loads).toEqual(['/one.png', '/two.png']);
    });
  });

  it('switches active images through the thumbnail strip', async () => {
    const user = userEvent.setup();

    render(<CanvagentWorkspace input={input} onSubmit={vi.fn()} />);

    const thumbnailStrip = screen.getByLabelText(/image navigation/i);
    await user.click(within(thumbnailStrip).getByRole('button', { name: 'Variation' }));

    expect(within(thumbnailStrip).getByRole('button', { name: 'Variation' })).toHaveAttribute('data-active', 'true');
  });

  it('submits the prompt draft through the host-neutral callback', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<CanvagentWorkspace input={input} onSubmit={onSubmit} />);

    await user.clear(screen.getByRole('textbox', { name: /message draft/i }));
    await user.type(screen.getByRole('textbox', { name: /message draft/i }), 'Move the title 24px higher.');
    await user.click(screen.getByRole('button', { name: /submit annotations/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].messageDraft).toBe('Move the title 24px higher.');
    expect(onSubmit.mock.calls[0]?.[0].attachments).toHaveLength(1);
  });

  it('preserves session and page metadata when submitting from a session-scoped workspace', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CanvagentWorkspace
        input={{
          ...input,
          activeImageId: 'img-2',
          context: {
            sessionId: 'thread-123',
            pageId: 'page-main',
            prompt: 'Keep the subject centered.',
          },
        }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: /submit annotations/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      sessionId: 'thread-123',
      pageId: 'page-main',
      activeImageId: 'img-2',
      structuredResult: {
        imageId: 'img-2',
        sessionImageId: 'img-2',
      },
    });
  });

  it('emits session state updates when the active image or prompt draft changes', async () => {
    const user = userEvent.setup();
    const onSessionStateChange = vi.fn();

    render(
      <CanvagentWorkspace
        input={{
          ...input,
          context: {
            sessionId: 'thread-123',
            pageId: 'page-main',
            prompt: 'Keep the subject centered.',
          },
        }}
        onSubmit={vi.fn()}
        onSessionStateChange={onSessionStateChange}
      />,
    );

    await user.click(within(screen.getByLabelText(/image navigation/i)).getByRole('button', { name: 'Variation' }));
    await user.clear(screen.getByRole('textbox', { name: /message draft/i }));
    await user.type(screen.getByRole('textbox', { name: /message draft/i }), 'Raise the badge and reduce the padding.');

    expect(onSessionStateChange).toHaveBeenCalled();
    expect(onSessionStateChange).toHaveBeenLastCalledWith({
      activeImageId: 'img-2',
      promptDraft: 'Raise the badge and reduce the padding.',
    });
  });

  it('shows a local image import action when the workbench opens empty', async () => {
    const user = userEvent.setup();
    const onImportLocalImage = vi.fn().mockResolvedValue(undefined);

    render(
      <CanvagentWorkspace
        input={{ images: [], context: { prompt: '' } }}
        onSubmit={vi.fn()}
        onImportLocalImage={onImportLocalImage}
      />,
    );

    expect(screen.getByText(/import a local image to start annotating/i)).toBeInTheDocument();

    const file = new File(['stub'], 'reference.png', { type: 'image/png' });
    const picker = screen.getByLabelText(/local image file picker/i);
    await user.upload(picker, file);

    expect(onImportLocalImage).toHaveBeenCalledTimes(1);
    expect(onImportLocalImage.mock.calls[0]?.[0]).toBeInstanceOf(File);
    expect(onImportLocalImage.mock.calls[0]?.[0].name).toBe('reference.png');
  });
});
