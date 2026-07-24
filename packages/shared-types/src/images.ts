export type WorkspaceImageKind = 'original' | 'generated' | 'edited' | 'candidate' | 'reference';

export type WorkspaceImage = {
  id: string;
  src: string;
  kind?: WorkspaceImageKind;
  title?: string;
  thumbnailSrc?: string;
  assetPath?: string;
  sessionImageId?: string;
  parentImageId?: string | null;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type OpenWorkspaceInput = {
  images: WorkspaceImage[];
  activeImageId?: string;
  context?: {
    taskId?: string;
    sessionId?: string;
    pageId?: string;
    prompt?: string;
    metadata?: Record<string, unknown>;
  };
};
