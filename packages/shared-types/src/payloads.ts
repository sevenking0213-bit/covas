import type { WorkspaceAnnotation } from './annotations';

export type SubmitAttachment = {
  id: string;
  kind: 'annotated-image' | 'snapshot' | 'thumbnail';
  mimeType: string;
  name: string;
  dataUrl?: string;
  filePath?: string;
};

export type StructuredResult = {
  imageId: string;
  sessionImageId?: string;
  annotations: WorkspaceAnnotation[];
  summary?: string;
  createdAt: number;
};

export type SubmitPayload = {
  sessionId?: string;
  pageId?: string;
  activeImageId?: string;
  attachments: SubmitAttachment[];
  messageDraft: string;
  structuredResult: StructuredResult;
};
