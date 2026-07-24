import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/codex-widget/src/App';

const workspaceSpy = vi.fn();

vi.mock('@covas/workspace', () => ({
  CanvagentWorkspace: (props: {
    input: {
      context?: { sessionId?: string; pageId?: string };
      images: Array<{ id: string; src: string; title?: string }>;
      activeImageId?: string;
    };
    onSubmit: (payload: {
      attachments: Array<{ id: string; kind: 'annotated-image'; mimeType: string; name: string }>;
      messageDraft: string;
      sessionId?: string;
      pageId?: string;
      activeImageId?: string;
      structuredResult: { imageId: string; sessionImageId?: string; annotations: unknown[]; createdAt: number };
    }) => void | Promise<void>;
    onSessionStateChange?: (state: { activeImageId: string; promptDraft: string }) => void;
    onImportLocalImage?: (file: File) => void | Promise<void>;
  }) => {
    workspaceSpy(props);

    return (
      <div>
        <div aria-label="Active image count">{props.input.images.length}</div>
        <div aria-label="Active image source">{props.input.images[0]?.src ?? 'empty'}</div>
        <div aria-label="Image navigation" />
        <button
          type="button"
          aria-label="Submit annotations"
          onClick={() =>
            void props.onSubmit({
              attachments: [
                {
                  id: 'attachment-1',
                  kind: 'annotated-image',
                  mimeType: 'image/png',
                  name: 'annotated.png',
                  dataUrl:
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tmNwAAAAASUVORK5CYII=',
                },
              ],
              messageDraft: 'Raise the badge.',
              sessionId: props.input.context?.sessionId,
              pageId: props.input.context?.pageId,
              activeImageId: 'img-2',
              structuredResult: {
                imageId: 'img-2',
                sessionImageId: 'img-2',
                annotations: [],
                createdAt: 1,
              },
            })
          }
        >
          Submit
        </button>
        <button
          type="button"
          aria-label="Sync session state"
          onClick={() => props.onSessionStateChange?.({ activeImageId: 'img-2', promptDraft: 'Tighten the crop.' })}
        >
          Sync
        </button>
        <label>
          <span className="sr-only">Local image file picker</span>
          <input
            type="file"
            aria-label="Local image file picker"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                void props.onImportLocalImage?.(file);
              }
            }}
          />
        </label>
      </div>
    );
  },
}));

declare global {
  interface Window {
    __COVAS_CODEX_HOST__?: {
      bootstrap?: {
        manifest: {
          sessionId: string;
          activePageId: string;
          activeImageId: string | null;
          imageOrder: string[];
          imagesById: Record<string, {
            id: string;
            kind: 'original' | 'generated' | 'edited' | 'candidate' | 'reference';
            fileName: string;
            assetPath: string;
            thumbnailPath: string;
            createdAt: string;
            parentImageId: string | null;
          }>;
          pageStateById?: Record<string, {
            pageId: string;
            activeImageId: string | null;
            promptDraft: string;
          }>;
        };
        title?: string;
        subtitle?: string;
        statusText?: string;
      };
      onSubmit?: ReturnType<typeof vi.fn>;
      onSessionStateChange?: ReturnType<typeof vi.fn>;
      sendFollowUpMessage?: ReturnType<typeof vi.fn>;
      getHostCapabilities?: ReturnType<typeof vi.fn>;
    };
    openai?: {
      callServerTool?: ReturnType<typeof vi.fn>;
      sendFollowUpMessage?: ReturnType<typeof vi.fn>;
      hostCapabilities?: {
        message?: {
          image?: boolean;
        };
      };
      toolOutput?: {
        bootstrap?: {
          manifest: {
            sessionId: string;
            activePageId: string;
            activeImageId: string | null;
            imageOrder: string[];
            imagesById: Record<string, {
              id: string;
              kind: 'original' | 'generated' | 'edited' | 'candidate' | 'reference';
              fileName: string;
              assetPath: string;
              thumbnailPath: string;
              createdAt: string;
              parentImageId: string | null;
            }>;
            pageStateById?: Record<string, {
              pageId: string;
              activeImageId: string | null;
              promptDraft: string;
            }>;
          };
          title?: string;
          subtitle?: string;
          statusText?: string;
        };
      };
    };
  }
}

afterEach(() => {
  cleanup();
  workspaceSpy.mockReset();
  delete window.__COVAS_CODEX_HOST__;
  delete window.openai;
});

describe('codex-widget App', () => {
  it('renders a codex-first workspace shell from session history input', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Covas Annotation' })).toBeInTheDocument();
    expect(screen.getByLabelText(/image navigation/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit annotations/i })).toBeInTheDocument();
  });

  it('prefers host-provided bootstrap manifest and copy', () => {
    window.__COVAS_CODEX_HOST__ = {
      bootstrap: {
        title: 'Injected Codex Session',
        subtitle: 'Host-provided bootstrap.',
        statusText: 'Ready for Codex handoff.',
        manifest: {
          sessionId: 'thread-hosted',
          activePageId: 'page-a',
          activeImageId: 'img-9',
          imageOrder: ['img-9'],
          imagesById: {
            'img-9': {
              id: 'img-9',
              kind: 'generated',
              fileName: 'Hosted result',
              assetPath: '/hosted.png',
              thumbnailPath: '/hosted.png',
              createdAt: '2026-07-23T10:10:00.000Z',
              parentImageId: null,
            },
          },
          pageStateById: {
            'page-a': {
              pageId: 'page-a',
              activeImageId: 'img-9',
              promptDraft: 'Describe the next revision.',
            },
          },
        },
      },
    };

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Injected Codex Session' })).toBeInTheDocument();
    expect(screen.getByText('Host-provided bootstrap.')).toBeInTheDocument();
    expect(screen.getByText('Ready for Codex handoff.')).toBeInTheDocument();
    expect(screen.getByText('thread-hosted')).toBeInTheDocument();
  });

  it('accepts bootstrap data from window.openai.toolOutput', () => {
    window.openai = {
      toolOutput: {
        bootstrap: {
          title: 'Tool Output Session',
          subtitle: 'Codex host injected the widget bootstrap.',
          statusText: 'Connected through tool output.',
          manifest: {
            sessionId: 'thread-tool-output',
            activePageId: 'page-tool',
            activeImageId: 'img-tool',
            imageOrder: ['img-tool'],
            imagesById: {
              'img-tool': {
                id: 'img-tool',
                kind: 'generated',
                fileName: 'Tool result',
                assetPath: '/tool-output.png',
                thumbnailPath: '/tool-output.png',
                createdAt: '2026-07-23T10:15:00.000Z',
                parentImageId: null,
              },
            },
            pageStateById: {
              'page-tool': {
                pageId: 'page-tool',
                activeImageId: 'img-tool',
                promptDraft: 'Revise from tool output bootstrap.',
              },
            },
          },
        },
      },
    };

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Tool Output Session' })).toBeInTheDocument();
    expect(screen.getByText('Codex host injected the widget bootstrap.')).toBeInTheDocument();
    expect(screen.getByText('Connected through tool output.')).toBeInTheDocument();
    expect(screen.getByText('thread-tool-output')).toBeInTheDocument();
  });

  it('refreshes when Codex injects bootstrap globals after mount', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Covas Annotation' })).toBeInTheDocument();

    window.openai = {
      toolOutput: {
        bootstrap: {
          title: 'Late Host Bootstrap',
          subtitle: 'Injected after the widget mounted.',
          statusText: 'Bootstrap received.',
          manifest: {
            sessionId: 'thread-late',
            activePageId: 'page-late',
            activeImageId: 'img-late',
            imageOrder: ['img-late'],
            imagesById: {
              'img-late': {
                id: 'img-late',
                kind: 'generated',
                fileName: 'Late image',
                assetPath: '/late.png',
                thumbnailPath: '/late.png',
                createdAt: '2026-07-23T10:20:00.000Z',
                parentImageId: null,
              },
            },
            pageStateById: {
              'page-late': {
                pageId: 'page-late',
                activeImageId: 'img-late',
                promptDraft: 'Take the host-injected path.',
              },
            },
          },
        },
      },
    };
    window.dispatchEvent(new Event('openai:set_globals'));

    expect(await screen.findByRole('heading', { name: 'Late Host Bootstrap' })).toBeInTheDocument();
    expect(screen.getByText('Injected after the widget mounted.')).toBeInTheDocument();
    expect(screen.getByText('Bootstrap received.')).toBeInTheDocument();
  });

  it('imports a local image into an empty Canvagent session', async () => {
    const user = userEvent.setup();

    window.openai = {
      toolOutput: {
        bootstrap: {
          title: 'Empty Session',
          subtitle: 'Start empty.',
          statusText: 'Waiting for an image.',
          manifest: {
            sessionId: 'thread-empty',
            activePageId: 'page-empty',
            activeImageId: null,
            imageOrder: [],
            imagesById: {},
            pageStateById: {
              'page-empty': {
                pageId: 'page-empty',
                activeImageId: null,
                promptDraft: '',
              },
            },
          },
        },
      },
    };

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: null | ((event: ProgressEvent<FileReader>) => void) = null;

      readAsDataURL(file: Blob) {
        this.result = `data:${file.type};base64,ZmFrZS1pbWFnZQ==`;
        this.onload?.({ target: this } as ProgressEvent<FileReader>);
      }
    }

    const originalFileReader = window.FileReader;
    // @ts-expect-error test shim
    window.FileReader = MockFileReader;

    render(<App />);

    expect(screen.getByLabelText(/active image count/i)).toHaveTextContent('0');
    expect(screen.getByLabelText(/active image source/i)).toHaveTextContent('empty');

    const file = new File(['fake-image'], 'uploaded.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/local image file picker/i), file);

    expect(screen.getByLabelText(/active image count/i)).toHaveTextContent('1');
    expect(screen.getByLabelText(/active image source/i).textContent).toContain('data:image/png;base64,ZmFrZS1pbWFnZQ==');

    window.FileReader = originalFileReader;
  });

  it('persists the current session manifest through the Codex server bridge', async () => {
    const callServerTool = vi.fn().mockResolvedValue({});

    window.openai = {
      callServerTool,
      toolOutput: {
        projectDir: '/tmp/canvagent-project',
        bootstrap: {
          title: 'Persisted Session',
          subtitle: 'Save back to the host.',
          statusText: 'Ready.',
          manifest: {
            sessionId: 'thread-persist',
            activePageId: 'page-main',
            activeImageId: null,
            imageOrder: [],
            imagesById: {},
            pageStateById: {
              'page-main': {
                pageId: 'page-main',
                activeImageId: null,
                promptDraft: '',
              },
            },
          },
        },
      },
    };

    render(<App />);

    expect(callServerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'save_covas_session_state',
        arguments: expect.objectContaining({
          projectDir: '/tmp/canvagent-project',
          manifest: expect.objectContaining({
            sessionId: 'thread-persist',
          }),
        }),
      }),
    );
  });

  it('forwards session state updates and submit payloads to the host callbacks', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onSessionStateChange = vi.fn();

    window.__COVAS_CODEX_HOST__ = {
      bootstrap: {
        manifest: {
          sessionId: 'thread-hosted',
          activePageId: 'page-a',
          activeImageId: 'img-1',
          imageOrder: ['img-1', 'img-2'],
          imagesById: {
            'img-1': {
              id: 'img-1',
              kind: 'original',
              fileName: 'Original',
              assetPath: '/one.png',
              thumbnailPath: '/one.png',
              createdAt: '2026-07-23T10:00:00.000Z',
              parentImageId: null,
            },
            'img-2': {
              id: 'img-2',
              kind: 'generated',
              fileName: 'Variation',
              assetPath: '/two.png',
              thumbnailPath: '/two.png',
              createdAt: '2026-07-23T10:05:00.000Z',
              parentImageId: 'img-1',
            },
          },
          pageStateById: {
            'page-a': {
              pageId: 'page-a',
              activeImageId: 'img-1',
              promptDraft: 'Initial prompt',
            },
          },
        },
      },
      onSubmit,
      onSessionStateChange,
    };

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Sync session state' }));
    await user.click(screen.getByRole('button', { name: /submit annotations/i }));

    expect(onSessionStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        activeImageId: 'img-2',
        pageStateById: {
          'page-a': {
            pageId: 'page-a',
            activeImageId: 'img-2',
            promptDraft: 'Tighten the crop.',
          },
        },
      }),
      { activeImageId: 'img-2', promptDraft: 'Tighten the crop.' },
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'thread-hosted',
        pageId: 'page-a',
        activeImageId: 'img-2',
      }),
    );
  });

  it('sends the revision request back through the Codex follow-up bridge when available', async () => {
    const user = userEvent.setup();
    const sendFollowUpMessage = vi.fn().mockResolvedValue(undefined);

    window.openai = {
      sendFollowUpMessage,
      hostCapabilities: {
        message: {
          image: true,
        },
      },
    };

    render(<App />);

    await user.click(screen.getByRole('button', { name: /submit annotations/i }));

    expect(sendFollowUpMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Raise the badge.',
        content: [
          { type: 'text', text: 'Raise the badge.' },
          expect.objectContaining({
            type: 'image',
            mimeType: 'image/png',
            _meta: expect.objectContaining({
              sessionId: 'codex-thread-demo',
              pageId: 'page-main',
              activeImageId: 'img-2',
            }),
          }),
        ],
      }),
    );
  });
});
