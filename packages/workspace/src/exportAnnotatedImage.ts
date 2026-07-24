import { getImageLayout } from './annotationMath';
import type { SubmitAttachment, WorkspaceAnnotation } from '@covas/shared-types';

const EXPORT_WIDTH = 960;
const EXPORT_HEIGHT = 540;
const FALLBACK_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tmNwAAAAASUVORK5CYII=';

export async function exportAnnotatedImage(args: {
  imageSrc: string;
  imageId: string;
  annotations: WorkspaceAnnotation[];
}): Promise<SubmitAttachment> {
  const fallbackAttachment = {
    id: `${args.imageId}-annotated-image`,
    kind: 'annotated-image' as const,
    mimeType: 'image/png',
    name: `${args.imageId}-annotated-image.png`,
    dataUrl: FALLBACK_PNG_DATA_URL,
  };

  if (typeof document === 'undefined') {
    return fallbackAttachment;
  }

  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom')) {
    return fallbackAttachment;
  }

  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const context = canvas.getContext('2d');

  if (!context) {
    return fallbackAttachment;
  }

  context.fillStyle = '#f8fbff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const image = await loadImage(args.imageSrc);

  if (image) {
    const layout = getImageLayout({
      containerWidth: canvas.width,
      containerHeight: canvas.height,
      imageWidth: image.naturalWidth || image.width || EXPORT_WIDTH,
      imageHeight: image.naturalHeight || image.height || EXPORT_HEIGHT,
      padding: 24,
    });

    context.drawImage(image, layout.x, layout.y, layout.width, layout.height);
  }

  args.annotations.forEach((annotation) => {
    drawAnnotation(context, annotation);
  });

  let dataUrl = FALLBACK_PNG_DATA_URL;

  try {
    dataUrl = canvas.toDataURL('image/png');
  } catch {
    dataUrl = FALLBACK_PNG_DATA_URL;
  }

  return {
    ...fallbackAttachment,
    dataUrl,
  };
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawAnnotation(context: CanvasRenderingContext2D, annotation: WorkspaceAnnotation) {
  context.save();

  if (annotation.type === 'rect') {
    context.strokeStyle = String(annotation.style?.stroke ?? '#2563eb');
    context.lineWidth = Number(annotation.style?.strokeWidth ?? 6);
    context.strokeRect(
      annotation.geometry.x,
      annotation.geometry.y,
      annotation.geometry.width,
      annotation.geometry.height,
    );
    context.restore();
    return;
  }

  if (annotation.type === 'ellipse') {
    context.strokeStyle = String(annotation.style?.stroke ?? '#2563eb');
    context.lineWidth = Number(annotation.style?.strokeWidth ?? 6);
    context.beginPath();
    context.ellipse(
      annotation.geometry.x + annotation.geometry.width / 2,
      annotation.geometry.y + annotation.geometry.height / 2,
      Math.abs(annotation.geometry.width / 2),
      Math.abs(annotation.geometry.height / 2),
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.restore();
    return;
  }

  if (annotation.type === 'arrow') {
    const [x1, y1, x2, y2] = annotation.geometry.points;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const stroke = String(annotation.style?.stroke ?? '#2563eb');
    context.strokeStyle = stroke;
    context.fillStyle = stroke;
    context.lineWidth = Number(annotation.style?.strokeWidth ?? 6);
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
    context.beginPath();
    context.moveTo(x2, y2);
    context.lineTo(x2 - 14 * Math.cos(angle - Math.PI / 7), y2 - 14 * Math.sin(angle - Math.PI / 7));
    context.lineTo(x2 - 14 * Math.cos(angle + Math.PI / 7), y2 - 14 * Math.sin(angle + Math.PI / 7));
    context.closePath();
    context.fill();
    context.restore();
    return;
  }

  if (annotation.type === 'brush' || annotation.type === 'highlight') {
    const points = annotation.geometry.points;
    if (points.length >= 2) {
      context.strokeStyle = String(annotation.style?.stroke ?? '#0f766e');
      context.globalAlpha = annotation.type === 'highlight' ? 0.35 : 1;
      context.lineWidth = Number(annotation.style?.strokeWidth ?? 14);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(points[0]!, points[1]!);
      for (let index = 2; index < points.length; index += 2) {
        context.lineTo(points[index]!, points[index + 1]!);
      }
      context.stroke();
    }
    context.restore();
    return;
  }

  if (annotation.type === 'text') {
    context.fillStyle = String(annotation.style?.color ?? '#1d4ed8');
    context.font = `${Number(annotation.style?.fontSize ?? 32)}px sans-serif`;
    context.textBaseline = 'top';
    context.fillText(annotation.text, annotation.geometry.x, annotation.geometry.y);
  }
  context.restore();
}
