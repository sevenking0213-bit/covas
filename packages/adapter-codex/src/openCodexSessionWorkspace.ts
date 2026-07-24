import type { OpenCodexSessionWorkspaceInput, OpenWorkspaceInput } from '@covas/shared-types';

export function openCodexSessionWorkspace(input: OpenCodexSessionWorkspaceInput): OpenWorkspaceInput {
  const pageState = input.manifest.pageStateById?.[input.manifest.activePageId];

  return {
    activeImageId: pageState?.activeImageId ?? input.manifest.activeImageId ?? undefined,
    context: {
      sessionId: input.sessionId,
      pageId: input.manifest.activePageId,
      prompt: pageState?.promptDraft ?? '',
    },
    images: input.manifest.imageOrder
      .map((imageId) => input.manifest.imagesById[imageId])
      .filter((image): image is NonNullable<typeof image> => Boolean(image))
      .map((image) => ({
        id: image.id,
        src: image.assetPath,
        kind: image.kind,
        title: image.fileName,
        thumbnailSrc: image.thumbnailPath,
        assetPath: image.assetPath,
        sessionImageId: image.id,
        parentImageId: image.parentImageId,
        createdAt: image.createdAt,
      })),
  };
}
