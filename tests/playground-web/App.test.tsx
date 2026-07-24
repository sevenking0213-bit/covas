import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/playground-web/src/App';

const sessionTrees: Array<{
  input: {
    images: Array<{ id: string; title?: string }>;
    context?: { sessionId?: string; pageId?: string; prompt?: string };
  };
  onSubmit?: (payload: {
    attachments: Array<{ id: string; name: string }>;
    messageDraft: string;
    sessionId?: string;
    pageId?: string;
    activeImageId?: string;
    structuredResult: { imageId: string; annotations: Array<{ type: string }> };
  }) => void | Promise<void>;
}> = [];

vi.mock('@covas/adapter-web', () => ({
  createWebWorkspaceSession: (args: (typeof sessionTrees)[number]) => {
    sessionTrees.push(args);

    return (
      <div>
        <div aria-label="Image navigation" />
        <button
          type="button"
          aria-label="Submit annotations"
          onClick={() =>
            void args.onSubmit?.({
              attachments: [{ id: 'attachment-1', name: 'annotated.png' }],
              messageDraft: 'Lift the badge and tighten the crop.',
              sessionId: args.input.context?.sessionId,
              pageId: args.input.context?.pageId,
              activeImageId: args.input.images[1]?.id ?? args.input.images[0]?.id,
              structuredResult: {
                imageId: args.input.images[1]?.id ?? args.input.images[0]?.id ?? 'unknown',
                annotations: [{ type: 'text' }],
              },
            })
          }
        >
          Submit
        </button>
      </div>
    );
  },
}));

afterEach(() => {
  cleanup();
  sessionTrees.length = 0;
});

describe('playground demo host', () => {
  it('shows the local demo session framing for GitHub users', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /local demo host/i })).toBeInTheDocument();
    expect(screen.getByText(/load the sample codex-style session/i)).toBeInTheDocument();
    expect(screen.getByText(/sample-original/i)).toBeInTheDocument();
    expect(screen.getByText(/sample-variation/i)).toBeInTheDocument();
  });

  it('renders the latest submit result directly in the page after a demo submission', async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole('button', { name: /submit annotations/i }));

    expect(screen.getByText(/last submission/i)).toBeInTheDocument();
    expect(screen.getAllByText(/annotated\.png/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/lift the badge and tighten the crop\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sample-variation/i).length).toBeGreaterThan(0);
  });
});
