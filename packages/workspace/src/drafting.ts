import type { WorkspaceAnnotation } from '@covas/shared-types';
import { normalizeRect } from './annotationMath';

const createId = () => `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function createDraftAnnotation(
  tool: 'brush' | 'rectangle' | 'ellipse' | 'arrow',
  point: { x: number; y: number },
  style: { stroke: string; strokeWidth: number },
): WorkspaceAnnotation {
  if (tool === 'brush') {
    return {
      id: createId(),
      type: 'brush',
      geometry: { points: [point.x, point.y] },
      style,
    };
  }

  if (tool === 'rectangle') {
    return {
      id: createId(),
      type: 'rect',
      geometry: { x: point.x, y: point.y, width: 0, height: 0 },
      style,
    };
  }

  if (tool === 'ellipse') {
    return {
      id: createId(),
      type: 'ellipse',
      geometry: { x: point.x, y: point.y, width: 0, height: 0 },
      style,
    };
  }

  return {
    id: createId(),
    type: 'arrow',
    geometry: { points: [point.x, point.y, point.x, point.y] },
    style,
  };
}

export function updateDraftAnnotation(
  annotation: WorkspaceAnnotation,
  start: { x: number; y: number },
  current: { x: number; y: number },
): WorkspaceAnnotation {
  if (annotation.type === 'brush' || annotation.type === 'highlight') {
    return {
      ...annotation,
      geometry: { points: [...annotation.geometry.points, current.x, current.y] },
    };
  }

  if (annotation.type === 'arrow') {
    return {
      ...annotation,
      geometry: { points: [start.x, start.y, current.x, current.y] },
    };
  }

  if (annotation.type === 'rect' || annotation.type === 'ellipse') {
    return {
      ...annotation,
      geometry: normalizeRect(start.x, start.y, current.x, current.y),
    };
  }

  return annotation;
}

export function createTextAnnotation(args: {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  fill?: string;
  fillEnabled?: boolean;
}): WorkspaceAnnotation {
  return {
    id: args.id,
    type: 'text',
    text: args.text,
    geometry: { x: args.x, y: args.y },
    style: {
      color: args.color,
      fontSize: args.fontSize,
      fill: args.fill ?? '#ffffff',
      fillEnabled: args.fillEnabled ?? false,
    },
  };
}
