type AnnotationStyle = Record<string, unknown>;

type AnnotationBase = {
  id: string;
  label?: string;
  style?: AnnotationStyle;
};

export type RectAnnotation = AnnotationBase & {
  type: 'rect';
  geometry: { x: number; y: number; width: number; height: number };
};

export type EllipseAnnotation = AnnotationBase & {
  type: 'ellipse';
  geometry: { x: number; y: number; width: number; height: number };
};

export type ArrowAnnotation = AnnotationBase & {
  type: 'arrow';
  geometry: { points: [number, number, number, number] };
};

export type BrushAnnotation = AnnotationBase & {
  type: 'brush' | 'highlight';
  geometry: { points: number[] };
};

export type TextAnnotation = AnnotationBase & {
  type: 'text';
  geometry: { x: number; y: number };
  text: string;
};

export type WorkspaceAnnotation =
  | RectAnnotation
  | EllipseAnnotation
  | ArrowAnnotation
  | BrushAnnotation
  | TextAnnotation;
