import type { WorkspaceImageKind } from './images';

export type CanvagentSessionImageKind = WorkspaceImageKind | 'edited';

export type CanvagentSessionImageRecord = {
  id: string;
  kind: CanvagentSessionImageKind;
  fileName: string;
  assetPath: string;
  thumbnailPath: string;
  createdAt: string;
  parentImageId: string | null;
};

export type CanvagentSessionPageRecord = {
  id: string;
  title: string;
};

export type CanvagentSessionPageState = {
  pageId: string;
  activeImageId: string | null;
  promptDraft: string;
};

export type CanvagentSessionManifest = {
  sessionId: string;
  activePageId: string;
  activeImageId: string | null;
  imageOrder: string[];
  imagesById: Record<string, CanvagentSessionImageRecord>;
  pages: CanvagentSessionPageRecord[];
  pageStateById?: Record<string, CanvagentSessionPageState>;
};

export type CanvagentWorkspaceState = {
  version: 1;
  lastSessionId: string;
  activePageId: string;
  activeImageId: string | null;
  promptDraft: string;
  updatedAt: string;
};

export type OpenCodexSessionWorkspaceInput = {
  projectDir: string;
  sessionId: string;
  manifest: CanvagentSessionManifest;
};
