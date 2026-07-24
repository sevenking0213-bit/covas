import type { WorkspaceImage } from '@covas/shared-types';

type ThumbnailStripProps = {
  images: WorkspaceImage[];
  activeImageId: string | null;
  annotationsByImageId: Record<string, unknown[]>;
  onSelectImage: (imageId: string) => void;
};

export function ThumbnailStrip(props: ThumbnailStripProps) {
  return (
    <div className="canvagent-thumbnail-strip" aria-label="Image navigation">
      {props.images.map((image) => (
        <button
          key={image.id}
          type="button"
          data-active={String(image.id === props.activeImageId)}
          aria-label={image.title ?? image.id}
          className={image.id === props.activeImageId ? 'is-active' : ''}
          onClick={() => props.onSelectImage(image.id)}
        >
          <span className="canvagent-thumbnail-frame">
            <img src={image.thumbnailSrc ?? image.src} alt={image.title ?? image.id} />
          </span>
          {(props.annotationsByImageId[image.id]?.length ?? 0) > 0 ? (
            <span className="canvagent-thumbnail-badge" aria-hidden="true" />
          ) : null}
        </button>
      ))}
    </div>
  );
}
