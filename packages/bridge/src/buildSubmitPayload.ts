import type { SubmitAttachment, SubmitPayload, WorkspaceAnnotation } from '@covas/shared-types';

export function buildSubmitPayload(args: {
  imageId: string;
  sessionId?: string;
  pageId?: string;
  sessionImageId?: string;
  annotations: WorkspaceAnnotation[];
  messageDraft: string;
  attachment?: SubmitAttachment;
}): SubmitPayload {
  return {
    sessionId: args.sessionId,
    pageId: args.pageId,
    activeImageId: args.imageId,
    attachments: args.attachment ? [args.attachment] : [],
    messageDraft: args.messageDraft,
    structuredResult: {
      imageId: args.imageId,
      sessionImageId: args.sessionImageId,
      annotations: args.annotations,
      createdAt: Date.now(),
    },
  };
}
