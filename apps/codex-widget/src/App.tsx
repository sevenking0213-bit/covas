import { useEffect, useMemo, useState } from 'react';
import { CanvagentWorkspace } from '@covas/workspace';
import type { OpenWorkspaceInput, SubmitPayload } from '@covas/shared-types';

type SessionManifestLike = {
  sessionId: string;
  activePageId: string;
  activeImageId: string | null;
  imageOrder: string[];
  imagesById: Record<
    string,
    {
      id: string;
      kind: 'original' | 'generated' | 'edited' | 'candidate' | 'reference';
      fileName: string;
      assetPath: string;
      thumbnailPath: string;
      createdAt: string;
      parentImageId: string | null;
    }
  >;
  pageStateById?: Record<
    string,
    {
      pageId: string;
      activeImageId: string | null;
      promptDraft: string;
    }
  >;
};

type CodexHostBootstrap = {
  manifest: SessionManifestLike;
  title?: string;
  subtitle?: string;
  statusText?: string;
};

type CodexHostBridge = {
  bootstrap?: CodexHostBootstrap;
  onSubmit?: (payload: SubmitPayload) => void | Promise<void>;
  onSessionStateChange?: (
    manifest: SessionManifestLike,
    state: { activeImageId: string | null; promptDraft: string },
  ) => void | Promise<void>;
  sendFollowUpMessage?: (message: {
    prompt: string;
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; data: string; mimeType: string; _meta?: Record<string, unknown> }
    >;
  }) => void | Promise<void>;
  getHostCapabilities?: () => {
    message?: {
      image?: boolean;
    };
  } | null;
};

type OpenAiToolOutputPayload = {
  projectDir?: string;
  bootstrap?: CodexHostBootstrap;
};

const TOOL_SAVE_SESSION_STATE = 'save_covas_session_state';

declare global {
  interface Window {
    __COVAS_CODEX_HOST__?: CodexHostBridge;
    openai?: {
      callServerTool?: (request: { name: string; arguments?: Record<string, unknown> }) => Promise<unknown>;
      sendFollowUpMessage?: CodexHostBridge['sendFollowUpMessage'];
      hostCapabilities?: {
        message?: {
          image?: boolean;
        };
      };
      toolOutput?: OpenAiToolOutputPayload;
    };
  }
}

function openSessionWorkspace(manifest: SessionManifestLike): OpenWorkspaceInput {
  const pageState = manifest.pageStateById?.[manifest.activePageId];

  return {
    activeImageId: pageState?.activeImageId ?? manifest.activeImageId ?? undefined,
    context: {
      sessionId: manifest.sessionId,
      pageId: manifest.activePageId,
      prompt: pageState?.promptDraft ?? '',
    },
    images: manifest.imageOrder.map((imageId) => {
      const image = manifest.imagesById[imageId]!;
      return {
        id: image.id,
        src: image.assetPath,
        kind: image.kind,
        title: image.fileName,
        thumbnailSrc: image.thumbnailPath,
        sessionImageId: image.id,
        parentImageId: image.parentImageId,
        createdAt: image.createdAt,
      };
    }),
  };
}

function syncSessionState(manifest: SessionManifestLike, state: { activeImageId: string | null; promptDraft: string }) {
  return {
    ...manifest,
    activeImageId: state.activeImageId,
    pageStateById: {
      ...manifest.pageStateById,
      [manifest.activePageId]: {
        pageId: manifest.activePageId,
        activeImageId: state.activeImageId,
        promptDraft: state.promptDraft,
      },
    },
  };
}

function buildCodexSubmitPayload(payload: SubmitPayload) {
  return {
    ...payload,
    sessionId: payload.sessionId,
    pageId: payload.pageId,
    activeImageId: payload.activeImageId,
  };
}

function getFollowUpSender(host: CodexHostBridge | null) {
  if (typeof host?.sendFollowUpMessage === 'function') {
    return host.sendFollowUpMessage;
  }

  if (typeof window !== 'undefined' && typeof window.openai?.sendFollowUpMessage === 'function') {
    return window.openai.sendFollowUpMessage;
  }

  return null;
}

function getHostCapabilities(host: CodexHostBridge | null) {
  try {
    if (typeof host?.getHostCapabilities === 'function') {
      return host.getHostCapabilities();
    }

    if (typeof window !== 'undefined') {
      return window.openai?.hostCapabilities ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

function attachmentToImageContent(dataUrl: string, meta: Record<string, unknown>) {
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error('The annotated image export is not a valid image data URL.');
  }

  return {
    type: 'image' as const,
    data: match[2],
    mimeType: match[1],
    _meta: meta,
  };
}

function buildFollowUpMessage(payload: SubmitPayload, host: CodexHostBridge | null) {
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string; _meta?: Record<string, unknown> }
  > = [{ type: 'text', text: payload.messageDraft }];
  const supportsMessageImages = Boolean(getHostCapabilities(host)?.message?.image);

  if (supportsMessageImages) {
    payload.attachments
      .filter((attachment) => attachment.kind === 'annotated-image' && attachment.dataUrl)
      .forEach((attachment) => {
        content.push(
          attachmentToImageContent(attachment.dataUrl!, {
            sessionId: payload.sessionId ?? null,
            pageId: payload.pageId ?? null,
            activeImageId: payload.activeImageId ?? payload.structuredResult.imageId,
            attachmentId: attachment.id,
            attachmentName: attachment.name,
            sessionImageId: payload.structuredResult.sessionImageId ?? null,
          }),
        );
      });
  }

  return {
    prompt: payload.messageDraft,
    content,
  };
}

function createInitialManifest(): SessionManifestLike {
  return {
    sessionId: 'codex-thread-demo',
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
  };
}

function createSessionImageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `img-${crypto.randomUUID()}`;
  }

  return `img-${Date.now()}`;
}

async function readFileAsDataUrl(file: File): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Canvagent could not read the selected image.'));
    };
    reader.onerror = () => reject(new Error('Canvagent could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function appendLocalImage(manifest: SessionManifestLike, args: { fileName: string; dataUrl: string }) {
  const imageId = createSessionImageId();
  const createdAt = new Date().toISOString();

  return {
    ...manifest,
    activeImageId: imageId,
    imageOrder: [...manifest.imageOrder, imageId],
    imagesById: {
      ...manifest.imagesById,
      [imageId]: {
        id: imageId,
        kind: 'reference' as const,
        fileName: args.fileName,
        assetPath: args.dataUrl,
        thumbnailPath: args.dataUrl,
        createdAt,
        parentImageId: manifest.activeImageId,
      },
    },
    pageStateById: {
      ...manifest.pageStateById,
      [manifest.activePageId]: {
        pageId: manifest.activePageId,
        activeImageId: imageId,
        promptDraft: manifest.pageStateById?.[manifest.activePageId]?.promptDraft ?? '',
      },
    },
  };
}

function getCodexHostBridge(): CodexHostBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__COVAS_CODEX_HOST__ ?? null;
}

function getBootstrapFromOpenAiToolOutput(): CodexHostBootstrap | null {
  const toolOutput = getOpenAiToolOutput();

  if (!toolOutput) {
    return null;
  }

  return toolOutput.bootstrap ?? null;
}

function getOpenAiToolOutput(): OpenAiToolOutputPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const toolOutput = window.openai?.toolOutput;

  if (!toolOutput || typeof toolOutput !== 'object') {
    return null;
  }

  return toolOutput as OpenAiToolOutputPayload;
}

async function persistManifestToHost(manifest: SessionManifestLike) {
  const toolOutput = getOpenAiToolOutput();
  const projectDir = toolOutput?.projectDir;

  if (!projectDir || typeof window === 'undefined' || typeof window.openai?.callServerTool !== 'function') {
    return;
  }

  await window.openai.callServerTool({
    name: TOOL_SAVE_SESSION_STATE,
    arguments: {
      projectDir,
      manifest,
    },
  });
}

function createHostModel() {
  const host = getCodexHostBridge();
  const bootstrap = host?.bootstrap ?? getBootstrapFromOpenAiToolOutput();

  return {
    host,
    manifest: bootstrap?.manifest ?? createInitialManifest(),
    title: bootstrap?.title ?? 'Covas Annotation',
    subtitle:
      bootstrap?.subtitle ??
      'Annotate the active image — draw boxes, arrows, and freehand marks, then send the result back into the conversation.',
    statusText: bootstrap?.statusText ?? 'Waiting for the next Codex handoff.',
  };
}

export function App() {
  const [model, setModel] = useState(() => createHostModel());
  const [manifest, setManifest] = useState<SessionManifestLike>(() => model.manifest);
  const [lastSubmitLabel, setLastSubmitLabel] = useState(model.statusText);
  const workspaceInput = useMemo(() => openSessionWorkspace(manifest), [manifest]);

  useEffect(() => {
    const syncHostModel = () => {
      const nextModel = createHostModel();
      setModel(nextModel);
      setManifest(nextModel.manifest);
      setLastSubmitLabel(nextModel.statusText);
    };

    window.addEventListener('openai:set_globals', syncHostModel);
    return () => {
      window.removeEventListener('openai:set_globals', syncHostModel);
    };
  }, []);

  useEffect(() => {
    void persistManifestToHost(manifest);
  }, [manifest]);

  return (
    <main className="codex-widget-app">
      <div className="codex-widget-shell">
        <header className="codex-widget-header">
          <div>
            <p className="codex-widget-eyebrow">Covas for Codex</p>
            <h1>{model.title}</h1>
            <p>{model.subtitle}</p>
          </div>
          <div className="codex-widget-session">
            <span className="codex-widget-session-label">Session</span>
            <span className="codex-widget-session-value">{manifest.sessionId}</span>
            <span className="codex-widget-session-label">Page</span>
            <span className="codex-widget-session-value">{manifest.activePageId}</span>
          </div>
        </header>

        <div className="codex-widget-status" aria-live="polite">
          {lastSubmitLabel}
        </div>

        <CanvagentWorkspace
          input={workspaceInput}
          onSessionStateChange={(state) => {
            setManifest((current) => {
              const nextManifest = syncSessionState(current, state);
              void model.host?.onSessionStateChange?.(nextManifest, state);
              return nextManifest;
            });
          }}
          onImportLocalImage={async (file) => {
            const dataUrl = await readFileAsDataUrl(file);
            setManifest((current) => appendLocalImage(current, { fileName: file.name, dataUrl }));
            setLastSubmitLabel(`Loaded ${file.name} into Canvagent.`);
          }}
          onSubmit={async (payload) => {
            const codexPayload = buildCodexSubmitPayload(payload);
            const followUpSender = getFollowUpSender(model.host);

            if (followUpSender) {
              await followUpSender(buildFollowUpMessage(codexPayload, model.host));
              setLastSubmitLabel(
                `Sent the revision request for ${codexPayload.activeImageId ?? 'the active image'} back to Codex.`,
              );
              return;
            }

            if (model.host?.onSubmit) {
              await model.host.onSubmit(codexPayload);
              setLastSubmitLabel(
                `Prepared ${codexPayload.attachments.length} attachment(s) for ${codexPayload.activeImageId ?? 'the active image'} in ${codexPayload.sessionId ?? 'the current session'}.`,
              );
              return;
            }

            setLastSubmitLabel('No Codex follow-up bridge is available for this workspace yet.');
            console.info('Canvagent Codex widget payload', codexPayload);
          }}
        />
      </div>
    </main>
  );
}
