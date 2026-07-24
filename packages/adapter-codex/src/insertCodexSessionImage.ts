import type { CanvagentSessionImageRecord, CanvagentSessionManifest } from '@covas/shared-types';

export function insertCodexSessionImage(args: {
  manifest: CanvagentSessionManifest;
  image: CanvagentSessionImageRecord;
}): CanvagentSessionManifest {
  return {
    ...args.manifest,
    activeImageId: args.image.id,
    imageOrder: [...args.manifest.imageOrder, args.image.id],
    imagesById: {
      ...args.manifest.imagesById,
      [args.image.id]: args.image,
    },
    pageStateById: {
      ...args.manifest.pageStateById,
      [args.manifest.activePageId]: {
        pageId: args.manifest.activePageId,
        activeImageId: args.image.id,
        promptDraft: args.manifest.pageStateById?.[args.manifest.activePageId]?.promptDraft ?? '',
      },
    },
  };
}
