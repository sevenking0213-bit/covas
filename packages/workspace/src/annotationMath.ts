import type { WorkspaceAnnotation } from '@covas/shared-types';
import { IMAGE_STAGE_PADDING } from './constants';

export function getImageLayout(args: {
  containerWidth: number;
  containerHeight: number;
  imageWidth: number;
  imageHeight: number;
  padding?: number;
}) {
  const padding = args.padding ?? IMAGE_STAGE_PADDING;
  const width = Math.max(1, args.containerWidth - padding * 2);
  const height = Math.max(1, args.containerHeight - padding * 2);
  const scale = Math.min(width / args.imageWidth, height / args.imageHeight);

  return {
    x: Math.round((args.containerWidth - args.imageWidth * scale) / 2),
    y: Math.round((args.containerHeight - args.imageHeight * scale) / 2),
    width: args.imageWidth * scale,
    height: args.imageHeight * scale,
    scale,
  };
}

export function normalizeRect(startX: number, startY: number, endX: number, endY: number) {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

export function translateAnnotation(annotation: WorkspaceAnnotation, dx: number, dy: number): WorkspaceAnnotation {
  if (annotation.type === 'brush' || annotation.type === 'highlight') {
    return {
      ...annotation,
      geometry: {
        points: annotation.geometry.points.map((value, index) => value + (index % 2 === 0 ? dx : dy)),
      },
    };
  }

  if (annotation.type === 'arrow') {
    const [x1, y1, x2, y2] = annotation.geometry.points;

    return {
      ...annotation,
      geometry: { points: [x1 + dx, y1 + dy, x2 + dx, y2 + dy] },
    };
  }

  if (annotation.type === 'text') {
    return {
      ...annotation,
      geometry: { x: annotation.geometry.x + dx, y: annotation.geometry.y + dy },
    };
  }

  if (annotation.type === 'rect' || annotation.type === 'ellipse') {
    return {
      ...annotation,
      geometry: {
        ...annotation.geometry,
        x: annotation.geometry.x + dx,
        y: annotation.geometry.y + dy,
      },
    };
  }

  return annotation;
}
