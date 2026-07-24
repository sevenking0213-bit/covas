import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createWebWorkspaceSession } from '@covas/adapter-web';

describe('createWebWorkspaceSession', () => {
  it('renders a workspace session with the provided open input', () => {
    const tree = createWebWorkspaceSession({
      input: {
        images: [{ id: 'img-1', src: '/one.png', title: 'Original' }],
      },
      onSubmit: vi.fn(),
    });

    render(tree);

    expect(screen.getByRole('heading', { name: 'Original' })).toBeInTheDocument();
  });
});
