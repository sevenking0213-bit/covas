import type { SubmitPayload } from '@covas/shared-types';

export function buildCodexSubmitResult(args: {
  sessionId: string;
  pageId: string;
  activeImageId: string;
  payload: SubmitPayload;
}): SubmitPayload {
  return {
    ...args.payload,
    sessionId: args.sessionId,
    pageId: args.pageId,
    activeImageId: args.activeImageId,
    structuredResult: {
      ...args.payload.structuredResult,
      sessionImageId: args.activeImageId,
    },
  };
}
