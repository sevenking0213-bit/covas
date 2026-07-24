import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Arrow,
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text as KonvaText,
  Transformer,
} from 'react-konva';
import type { WorkspaceAnnotation, WorkspaceImage } from '@covas/shared-types';
import { translateAnnotation } from '../annotationMath';
import { createDraftAnnotation, createTextAnnotation, updateDraftAnnotation } from '../drafting';
import type { WorkspaceImageObject } from '../state/workspaceState';
import type { AnnotationTool } from './Toolbar';
import { renderAnnotation } from './renderAnnotation';

const STAGE_WIDTH = 960;
const STAGE_HEIGHT = 540;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.05;
const STAGE_PADDING = 24;
const BOTTOM_PANEL_HEIGHT = 164;
const SHAPE_STROKE = '#2563eb';
const BRUSH_STROKE = 'rgba(37, 99, 235, 0.9)';
const SHAPE_STROKE_WIDTH = 6;
const BRUSH_STROKE_WIDTH = 16;
const TEXT_SIZE = 32;
const TEXT_COLOR = '#1d4ed8';
const MIN_SHAPE_SIZE = 4;
const SHAPE_STROKE_WIDTH_RANGE = { min: 2, max: 14 };
const BRUSH_STROKE_WIDTH_RANGE = { min: 10, max: 34 };
const TEXT_SIZE_OPTIONS = [16, 20, 24, 28, 32, 40, 48, 60] as const;
const COLOR_PALETTE = ['#2563eb', '#111827', '#6b7280', '#ffffff', '#ef4444', '#f59e0b', '#22c55e'] as const;

const IS_JSDOM = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom');

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const buildTextFill = (color: string) => color;

type AnnotationStageProps = {
  image: {
    id: string;
    src: string;
    title?: string;
  };
  annotations: WorkspaceAnnotation[];
  images?: WorkspaceImage[];
  imageObjectsById?: Record<string, WorkspaceImageObject>;
  selectedImageObjectIds?: string[];
  activeImageId?: string;
  annotationsByImageId?: Record<string, WorkspaceAnnotation[]>;
  onSelectImage?: (imageId: string) => void;
  onMoveImageObject?: (imageId: string, x: number, y: number) => void;
  tool: AnnotationTool;
  hasExplicitToolSelection?: boolean;
  stylePanelHost?: HTMLElement | null;
  onCommitAnnotations: (annotations: WorkspaceAnnotation[]) => void;
};

type LoadedImageState = {
  image: HTMLImageElement | null;
  width: number;
  height: number;
};

type LoadedImageMap = Record<string, LoadedImageState>;

type StyleKind = 'brush' | 'rectangle' | 'ellipse' | 'arrow' | 'text';

type StrokeStyleValue = {
  stroke: string;
  strokeWidth: number;
};

type TextStyleValue = {
  color: string;
  fontSize: number;
  fill: string;
  fillEnabled: boolean;
};

type TextEditorState = TextStyleValue & {
  x: number;
  y: number;
  value: string;
  annotationId: string | null;
  selectAllOnFocus?: boolean;
};

type ResizeHandlePosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

type AnnotationBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type NodeRefMap = Record<string, any>;

type ResizeDragState = {
  annotationId: string;
  annotationType: 'rect' | 'ellipse';
  handle: ResizeHandlePosition;
  startGeometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type StageImageItem = {
  id: string;
  src: string;
  title?: string;
};

type StageImageLayout = StageImageItem & {
  image: HTMLImageElement | null;
  intrinsicWidth: number;
  intrinsicHeight: number;
  worldX: number;
  worldY: number;
  worldWidth: number;
  worldHeight: number;
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  screenScale: number;
  titleX: number;
  titleY: number;
};

const STAGE_IMAGE_GAP = 40;
const STAGE_TITLE_HEIGHT = 20;
const STAGE_TITLE_GAP = 10;
const STAGE_IMAGE_MIN_HEIGHT = 220;
const STAGE_IMAGE_MAX_HEIGHT = 420;

export function AnnotationStage(props: AnnotationStageProps) {
  if (IS_JSDOM) {
    return <DomFallbackAnnotationStage {...props} />;
  }

  return <KonvaAnnotationStage {...props} />;
}

function renderStylePanelAnchor(
  host: HTMLElement | null | undefined,
  content: React.ReactNode,
) {
  const panel = (
    <div className="canvagent-stage-style-panel-anchor" data-testid="style-panel-anchor">
      {content}
    </div>
  );

  return host ? createPortal(panel, host) : panel;
}

function getStageImages(props: AnnotationStageProps): StageImageItem[] {
  if (props.images && props.images.length > 0) {
    return props.images.map((image) => ({
      id: image.id,
      src: image.src,
      title: image.title,
    }));
  }

  return [props.image];
}

function getStageImageLabel(image: StageImageItem) {
  return image.title ?? image.id;
}

function getStageViewportHeight(stageSizeHeight: number, stageImagesCount: number) {
  if (stageImagesCount > 1) {
    return stageSizeHeight;
  }

  return Math.max(1, stageSizeHeight - BOTTOM_PANEL_HEIGHT);
}

function getLoadedImageState(
  loadedImages: LoadedImageMap,
  imageId: string,
): LoadedImageState {
  return loadedImages[imageId] ?? { image: null, width: 1, height: 1 };
}

function buildStageImageLayouts(args: {
  stageImages: StageImageItem[];
  imageObjectsById?: Record<string, WorkspaceImageObject>;
  loadedImages: LoadedImageMap;
  stageSize: { width: number; height: number };
  zoomRatio: number;
  viewOffset: { x: number; y: number };
}): StageImageLayout[] {
  const viewportHeight = getStageViewportHeight(args.stageSize.height, args.stageImages.length);
  const baseImageHeight = clamp(
    viewportHeight - STAGE_PADDING * 2 - STAGE_TITLE_HEIGHT - STAGE_TITLE_GAP,
    STAGE_IMAGE_MIN_HEIGHT,
    STAGE_IMAGE_MAX_HEIGHT,
  );
  const isSingleImageStage = args.stageImages.length === 1;
  const originX = STAGE_PADDING + args.viewOffset.x;
  const originY = STAGE_PADDING + STAGE_TITLE_HEIGHT + STAGE_TITLE_GAP + args.viewOffset.y;
  let worldX = 0;

  return args.stageImages.map((image) => {
    const imageObject = args.imageObjectsById?.[image.id];
    const loadedImage = getLoadedImageState(args.loadedImages, image.id);
    const intrinsicWidth = Math.max(1, loadedImage.width);
    const intrinsicHeight = Math.max(1, loadedImage.height);
    const baseScale = baseImageHeight / intrinsicHeight;
    const worldWidth = intrinsicWidth * baseScale;
    const worldHeight = intrinsicHeight * baseScale;
    const screenScale = baseScale * args.zoomRatio;
    const resolvedWorldX = imageObject?.x ?? worldX;
    const resolvedWorldY = imageObject?.y ?? 0;
    const contentHeight = Math.max(1, viewportHeight - STAGE_PADDING * 2 - STAGE_TITLE_HEIGHT - STAGE_TITLE_GAP);
    const centeredScreenX = Math.max(
      STAGE_PADDING,
      (args.stageSize.width - intrinsicWidth * screenScale) / 2 + args.viewOffset.x,
    );
    const centeredScreenY = originY + Math.max(0, (contentHeight - intrinsicHeight * screenScale) / 2);
    const screenX = isSingleImageStage && !imageObject
      ? centeredScreenX
      : originX + resolvedWorldX * args.zoomRatio;
    const screenY = isSingleImageStage && !imageObject
      ? centeredScreenY
      : originY + resolvedWorldY * args.zoomRatio;
    const layout: StageImageLayout = {
      ...image,
      image: loadedImage.image,
      intrinsicWidth,
      intrinsicHeight,
      worldX: resolvedWorldX,
      worldY: resolvedWorldY,
      worldWidth,
      worldHeight,
      screenX,
      screenY,
      screenWidth: intrinsicWidth * screenScale,
      screenHeight: intrinsicHeight * screenScale,
      screenScale,
      titleX: screenX,
      titleY: isSingleImageStage && !imageObject
        ? Math.max(STAGE_PADDING, screenY - STAGE_TITLE_HEIGHT - STAGE_TITLE_GAP)
        : originY - STAGE_TITLE_HEIGHT - STAGE_TITLE_GAP,
    };

    worldX += worldWidth + STAGE_IMAGE_GAP;
    return layout;
  });
}

function getStageWorldOrigin(viewOffset: { x: number; y: number }) {
  return {
    x: STAGE_PADDING + viewOffset.x,
    y: STAGE_PADDING + STAGE_TITLE_HEIGHT + STAGE_TITLE_GAP + viewOffset.y,
  };
}

function isPointInsideImageBounds(args: {
  pointerX: number;
  pointerY: number;
  imageLayout: { x: number; y: number; width: number; height: number };
}) {
  return (
    args.pointerX >= args.imageLayout.x
    && args.pointerX <= args.imageLayout.x + args.imageLayout.width
    && args.pointerY >= args.imageLayout.y
    && args.pointerY <= args.imageLayout.y + args.imageLayout.height
  );
}

function getWorldPositionFromScreen(args: {
  screenX: number;
  screenY: number;
  zoomRatio: number;
  viewOffset: { x: number; y: number };
}) {
  const origin = getStageWorldOrigin(args.viewOffset);

  return {
    x: (args.screenX - origin.x) / args.zoomRatio,
    y: (args.screenY - origin.y) / args.zoomRatio,
  };
}

function KonvaAnnotationStage(props: AnnotationStageProps) {
  const hasExplicitToolSelection = props.hasExplicitToolSelection ?? false;
  const stageImages = useMemo(
    () => getStageImages(props),
    [props.images, props.image.id, props.image.src, props.image.title],
  );
  const isSingleImageStage = stageImages.length === 1;
  const activeImageId = props.activeImageId ?? props.image.id;
  const activeImage = stageImages.find((image) => image.id === activeImageId) ?? stageImages[0]!;
  const activeAnnotations = props.annotationsByImageId?.[activeImage.id] ?? props.annotations;
  const selectedImageObjectIds = props.selectedImageObjectIds ?? [];
  const stageAreaRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<any>(null);
  const annotationNodeRefs = useRef<NodeRefMap>({});
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const textEditorRef = useRef<TextEditorState | null>(null);
  const textCommitInFlightRef = useRef(false);
  const requestedImageSrcRef = useRef<Record<string, string>>({});
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panOriginRef = useRef({ x: 0, y: 0 });
  const drawingStartRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const pendingTextPlacementRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextTextPlacementRef = useRef(false);

  const [stageSize, setStageSize] = useState({ width: STAGE_WIDTH, height: STAGE_HEIGHT });
  const [loadedImages, setLoadedImages] = useState<LoadedImageMap>({});
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkspaceAnnotation | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [zoomRatio, setZoomRatio] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);
  const [sharedStrokeColor, setSharedStrokeColor] = useState(SHAPE_STROKE);
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(SHAPE_STROKE_WIDTH);
  const [brushStrokeWidth, setBrushStrokeWidth] = useState(BRUSH_STROKE_WIDTH);
  const [textToolStyle, setTextToolStyle] = useState<TextStyleValue>({
    color: TEXT_COLOR,
    fontSize: TEXT_SIZE,
    fill: '#ffffff',
    fillEnabled: false,
  });

  useEffect(() => {
    let cancelled = false;

    stageImages.forEach((stageImage) => {
      if (requestedImageSrcRef.current[stageImage.id] === stageImage.src) {
        return;
      }

      requestedImageSrcRef.current[stageImage.id] = stageImage.src;
      const image = new Image();

      image.onload = () => {
        if (cancelled) {
          return;
        }

        setLoadedImages((previous) => ({
          ...previous,
          [stageImage.id]: {
            image,
            width: image.naturalWidth || image.width || 1,
            height: image.naturalHeight || image.height || 1,
          },
        }));
      };

      image.onerror = () => {
        if (cancelled) {
          return;
        }

        setLoadedImages((previous) => ({
          ...previous,
          [stageImage.id]: { image: null, width: 1, height: 1 },
        }));
      };

      image.crossOrigin = 'anonymous';
      image.src = stageImage.src;
    });

    return () => {
      cancelled = true;
    };
  }, [stageImages]);

  useEffect(() => {
    if (!stageAreaRef.current) {
      return undefined;
    }

    if (typeof ResizeObserver === 'undefined') {
      const rect = stageAreaRef.current.getBoundingClientRect();
      setStageSize({
        width: Math.max(1, Math.round(rect.width || STAGE_WIDTH)),
        height: Math.max(1, Math.round(rect.height || STAGE_HEIGHT)),
      });
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setStageSize({
        width: Math.max(1, Math.round(entry.contentRect.width)),
        height: Math.max(1, Math.round(entry.contentRect.height)),
      });
    });

    observer.observe(stageAreaRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSelectedAnnotationId(null);
    setDraft(null);
    textEditorRef.current = null;
    setTextEditor(null);
    setHoverCursor(null);
  }, [activeImage.id]);

  useEffect(() => {
    if (props.tool !== 'pan') {
      return;
    }

    setSelectedAnnotationId(null);
    textEditorRef.current = null;
    setTextEditor(null);
  }, [props.tool]);

  useEffect(() => {
    textEditorRef.current = textEditor;
  }, [textEditor]);

  const stageImageLayouts = useMemo(() => buildStageImageLayouts({
    stageImages,
    imageObjectsById: props.imageObjectsById,
    loadedImages,
    stageSize,
    zoomRatio,
    viewOffset,
  }), [loadedImages, props.imageObjectsById, stageImages, stageSize, viewOffset, zoomRatio]);

  const activeStageImageLayout = stageImageLayouts.find((image) => image.id === activeImage.id) ?? {
    ...activeImage,
    image: null,
    intrinsicWidth: 1,
    intrinsicHeight: 1,
    worldX: 0,
    worldY: 0,
    worldWidth: 1,
    worldHeight: 1,
    screenX: STAGE_PADDING,
    screenY: STAGE_PADDING + STAGE_TITLE_HEIGHT + STAGE_TITLE_GAP,
    screenWidth: 1,
    screenHeight: 1,
    screenScale: 1,
    titleX: STAGE_PADDING,
    titleY: STAGE_PADDING,
  };

  const displayLayout = useMemo(() => ({
    x: activeStageImageLayout.screenX,
    y: activeStageImageLayout.screenY,
    width: activeStageImageLayout.screenWidth,
    height: activeStageImageLayout.screenHeight,
    scale: activeStageImageLayout.screenScale,
  }), [activeStageImageLayout]);

  const selectedAnnotation = activeAnnotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;

  const activeStyleKind = useMemo(() => {
    if (textEditor) {
      return 'text';
    }

    if (hasExplicitToolSelection && props.tool !== 'pan') {
      return getToolStyleKind(props.tool);
    }

    return null;
  }, [hasExplicitToolSelection, props.tool, textEditor]);

  const activeStrokeStyle = useMemo<StrokeStyleValue | null>(() => {
    if (!activeStyleKind || activeStyleKind === 'text') {
      return null;
    }

    return {
      stroke: sharedStrokeColor,
      strokeWidth: activeStyleKind === 'brush' ? brushStrokeWidth : shapeStrokeWidth,
    };
  }, [activeStyleKind, brushStrokeWidth, shapeStrokeWidth, sharedStrokeColor]);

  const activeTextStyle = useMemo<TextStyleValue | null>(() => {
    if (textEditor) {
      return getTextStyle(textEditor);
    }

    if (activeStyleKind === 'text') {
      return textToolStyle;
    }

    return null;
  }, [activeStyleKind, textEditor, textToolStyle]);

  const strokeWidthRange = useMemo(() => {
    if (activeStyleKind === 'brush') {
      return BRUSH_STROKE_WIDTH_RANGE;
    }

    return SHAPE_STROKE_WIDTH_RANGE;
  }, [activeStyleKind]);

  const textEditorPixelStyle = useMemo(() => {
    if (!textEditor) {
      return null;
    }

    const bounds = measureTextBounds(textEditor.value, textEditor.fontSize);
    const fontSize = Math.max(12, Math.round(textEditor.fontSize * displayLayout.scale));
    const lineHeight = Math.max(18, Math.round(fontSize * 1.28));
    const left = displayLayout.x + textEditor.x * displayLayout.scale;
    const minWidth = Math.max(36, Math.round(fontSize * 1.25));
    const maxWidth = Math.max(minWidth, stageSize.width - left - 24);
    const width = clamp(
      Math.round(bounds.width * displayLayout.scale + 18),
      minWidth,
      maxWidth,
    );

    return {
      left,
      top: displayLayout.y + textEditor.y * displayLayout.scale,
      width,
      fontSize,
      lineHeight,
    };
  }, [displayLayout.scale, displayLayout.x, displayLayout.y, stageSize.width, textEditor]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    if (!selectedAnnotation || textEditor || props.tool === 'pan' || !isTransformable(selectedAnnotation)) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const selectedNode = annotationNodeRefs.current[selectedAnnotation.id];
    if (!selectedNode) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    transformer.nodes([selectedNode]);
    transformer.getLayer()?.batchDraw();
  }, [props.tool, selectedAnnotation, textEditor]);

  const commitAnnotations = (annotations: WorkspaceAnnotation[]) => {
    props.onCommitAnnotations(annotations);
  };

  const updateSelectedAnnotation = (updater: (annotation: WorkspaceAnnotation) => WorkspaceAnnotation) => {
    if (!selectedAnnotationId) {
      return;
    }

    commitAnnotations(
      activeAnnotations.map((annotation) => (
        annotation.id === selectedAnnotationId ? updater(annotation) : annotation
      )),
    );
  };

  const syncSharedStrokeColor = (color: string) => {
    setSharedStrokeColor(color);
    setTextToolStyle((previous) => resolveNextTextStyle(previous, { color }));
  };

  const applyStrokeStyle = (patch: Partial<StrokeStyleValue>) => {
    if (hasExplicitToolSelection && activeStyleKind && activeStyleKind !== 'text') {
      if (patch.stroke !== undefined) {
        syncSharedStrokeColor(patch.stroke);
      }

      if (patch.strokeWidth !== undefined) {
        if (activeStyleKind === 'brush') {
          setBrushStrokeWidth(patch.strokeWidth);
        } else {
          setShapeStrokeWidth(patch.strokeWidth);
        }
      }
      return;
    }

    if (selectedAnnotation && isStrokeAnnotation(selectedAnnotation)) {
      updateSelectedAnnotation((annotation) => (
        annotation.type === 'text'
          ? annotation
          : {
              ...annotation,
              style: {
                ...annotation.style,
                stroke: patch.stroke ?? getStrokeColor(annotation),
                strokeWidth: patch.strokeWidth ?? getStrokeWidth(annotation),
              },
            }
      ));
    }
  };

  const applyTextStyle = (patch: Partial<TextStyleValue>) => {
    if (textEditor) {
      if (props.tool === 'text') {
        if (patch.color && !(patch.fillEnabled ?? textEditor.fillEnabled)) {
          syncSharedStrokeColor(patch.color);
        }
        setTextToolStyle((previous) => resolveNextTextStyle(previous, patch));
      }
      setTextEditor((previous) => (
        previous ? { ...previous, ...resolveNextTextStyle(previous, patch) } : previous
      ));
      return;
    }

    if (hasExplicitToolSelection && props.tool === 'text') {
      if (patch.color && !patch.fillEnabled && !textToolStyle.fillEnabled) {
        syncSharedStrokeColor(patch.color);
      }
      setTextToolStyle((previous) => resolveNextTextStyle(previous, patch));
      return;
    }

    if (selectedAnnotation?.type === 'text') {
      updateSelectedAnnotation((annotation) => (
        annotation.type !== 'text'
          ? annotation
          : {
              ...annotation,
              style: {
                ...annotation.style,
                ...resolveNextTextStyle(getTextStyle(annotation), patch),
              },
            }
      ));
    }
  };

  const commitTextEditorValue = (editor: TextEditorState | null) => {
    if (textCommitInFlightRef.current) {
      return;
    }

    textCommitInFlightRef.current = true;
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        textCommitInFlightRef.current = false;
      });
    } else {
      setTimeout(() => {
        textCommitInFlightRef.current = false;
      }, 0);
    }

    if (!editor) {
      textEditorRef.current = null;
      setTextEditor(null);
      return;
    }

    const currentEditor = editor!;
    const nextText = currentEditor.value.replace(/\r\n/g, '\n');
    if (!nextText.trim()) {
      if (currentEditor.annotationId) {
        commitAnnotations(
          activeAnnotations.filter((annotation) => annotation.id !== currentEditor.annotationId),
        );
      }
      textEditorRef.current = null;
      setTextEditor(null);
      return;
    }

    if (currentEditor.annotationId) {
      commitAnnotations(
        activeAnnotations.map((annotation) => (
          annotation.id === currentEditor.annotationId && annotation.type === 'text'
            ? {
                ...annotation,
                text: nextText,
                geometry: { x: currentEditor.x, y: currentEditor.y },
                style: {
                  ...annotation.style,
                  color: currentEditor.color,
                  fontSize: currentEditor.fontSize,
                  fill: currentEditor.fill,
                  fillEnabled: currentEditor.fillEnabled,
                },
              }
            : annotation
        )),
      );
      textEditorRef.current = null;
      setTextEditor(null);
      return;
    }

    commitAnnotations([
      ...activeAnnotations,
      createTextAnnotation({
        id: `text-${Date.now()}`,
        x: currentEditor.x,
        y: currentEditor.y,
        text: nextText,
        color: currentEditor.color,
        fontSize: currentEditor.fontSize,
        fill: currentEditor.fill,
        fillEnabled: currentEditor.fillEnabled,
      }),
    ]);
    textEditorRef.current = null;
    setTextEditor(null);
  };

  const getScenePointFromStage = (stage: any, requireWithinImage = false) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return null;
    }

    if (requireWithinImage && !isPointInsideImageBounds({
      pointerX: pointer.x,
      pointerY: pointer.y,
      imageLayout: displayLayout,
    })) {
      return null;
    }

    return {
      x: (pointer.x - displayLayout.x) / displayLayout.scale,
      y: (pointer.y - displayLayout.y) / displayLayout.scale,
    };
  };

  const getLiveTextEditor = () => {
    const editor = textEditorRef.current;
    if (!editor) {
      return null;
    }

    const input = textInputRef.current;
    if (!input) {
      return editor;
    }

    const nextEditor = { ...editor, value: input.value };
    textEditorRef.current = nextEditor;
    return nextEditor;
  };

  const handleStageMouseDown = (event: any) => {
    const stage = event.target.getStage();
    if (!stage) {
      return;
    }

    if (suppressNextTextPlacementRef.current) {
      suppressNextTextPlacementRef.current = false;
      return;
    }

    if (textEditorRef.current) {
      commitTextEditorValue(getLiveTextEditor());
      pendingTextPlacementRef.current = null;
      return;
    }

    if (isTransformerTarget(event.target) || isAnnotationTarget(event.target) || hasNodeName(event.target, 'arrow-endpoint')) {
      return;
    }

    if (props.tool === 'pan') {
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }

      isPanningRef.current = true;
      panStartRef.current = pointer;
      panOriginRef.current = viewOffset;
      setSelectedAnnotationId(null);
      return;
    }

    const point = getScenePointFromStage(stage);
    if (!point) {
      return;
    }

    if (props.tool === 'text') {
      setSelectedAnnotationId(null);
      pendingTextPlacementRef.current = point;
      return;
    }

    const shapeTool = getShapeTool(props.tool);
    if (!shapeTool) {
      return;
    }

    drawingStartRef.current = point;
    setSelectedAnnotationId(null);
    setDraft(createDraftAnnotation(shapeTool, point, {
      stroke: sharedStrokeColor,
      strokeWidth: shapeTool === 'brush' ? brushStrokeWidth : shapeStrokeWidth,
    }));
  };

  useEffect(() => {
    if (!textEditor) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const input = textInputRef.current;
      if (!input) {
        return;
      }
      if (event.target instanceof Node && input.contains(event.target)) {
        return;
      }
      suppressNextTextPlacementRef.current = true;
      commitTextEditorValue(getLiveTextEditor());
      pendingTextPlacementRef.current = null;
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [commitTextEditorValue, textEditor]);

  const handleStageMouseMove = (event: any) => {
    const stage = event.target.getStage();
    if (!stage) {
      return;
    }

    const pointer = stage.getPointerPosition();
    const hoveredNode = pointer ? stage.getIntersection(pointer) : event.target;
    const arrowEndpointCursor = getArrowEndpointHoverCursor(hoveredNode ?? event.target);
    const transformerCursor = getTransformerCursor(hoveredNode ?? event.target);
    const nextHoverCursor =
      props.tool === 'pan'
        ? null
        : arrowEndpointCursor
          ? arrowEndpointCursor
          : transformerCursor
            ? transformerCursor
            : isAnnotationTarget(hoveredNode ?? event.target)
              ? 'move'
              : null;

    setHoverCursor((current) => (current === nextHoverCursor ? current : nextHoverCursor));

    if (isPanningRef.current) {
      if (!pointer || !panStartRef.current) {
        return;
      }

      setViewOffset({
        x: panOriginRef.current.x + (pointer.x - panStartRef.current.x),
        y: panOriginRef.current.y + (pointer.y - panStartRef.current.y),
      });
      return;
    }

    if (!draft || !drawingStartRef.current) {
      return;
    }

    const point = getScenePointFromStage(stage);
    if (!point) {
      return;
    }

    setDraft(updateDraftAnnotation(draft, drawingStartRef.current, point));
  };

  const handleStageMouseUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      return;
    }

    if (props.tool === 'text') {
      const pendingTextPlacement = pendingTextPlacementRef.current;
      pendingTextPlacementRef.current = null;
      if (pendingTextPlacement) {
        const nextEditor = {
          x: pendingTextPlacement.x,
          y: pendingTextPlacement.y,
          value: '',
          annotationId: null,
          ...textToolStyle,
        };
        textEditorRef.current = nextEditor;
        setTextEditor(nextEditor);
      }
      return;
    }

    drawingStartRef.current = null;

    if (!draft) {
      return;
    }

    if (!isDrawableAnnotation(draft)) {
      setDraft(null);
      return;
    }

    commitAnnotations([...activeAnnotations, draft]);
    setDraft(null);
  };

  const handleStageMouseLeave = () => {
    setHoverCursor(null);
  };

  const handleStageWheel = (event: any) => {
    event.evt.preventDefault();
    setZoomRatio((current) => clampZoom(current + (event.evt.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)));
  };

  const handleSelectImageObject = (imageId: string) => {
    props.onSelectImage?.(imageId);
    setSelectedAnnotationId(null);
    textEditorRef.current = null;
    setTextEditor(null);
  };

  const handleMoveImageObject = (imageId: string, screenX: number, screenY: number) => {
    if (!props.onMoveImageObject) {
      return;
    }

    const nextPosition = getWorldPositionFromScreen({
      screenX,
      screenY,
      zoomRatio,
      viewOffset,
    });

    props.onMoveImageObject(imageId, nextPosition.x, nextPosition.y);
  };

  const handleSelectAnnotation = (annotationId: string) => {
    if (props.tool === 'pan') {
      textEditorRef.current = null;
      setTextEditor(null);
      setSelectedAnnotationId(null);
      return;
    }

    setSelectedAnnotationId(annotationId);
    textEditorRef.current = null;
    setTextEditor(null);
  };

  const handleDragAnnotation = (annotation: WorkspaceAnnotation, dx: number, dy: number) => {
    commitAnnotations(
      activeAnnotations.map((item) => (
        item.id === annotation.id ? translateAnnotation(item, dx, dy) : item
      )),
    );
  };

  const handleTransformAnnotation = (annotationId: string) => {
    const annotation = activeAnnotations.find((item) => item.id === annotationId);
    const node = annotationNodeRefs.current[annotationId];
    if (!annotation || !node) {
      return;
    }

    if (annotation.type === 'text') {
      const nextFontSize = Math.max(
        12,
        Math.round(getTextFontSize(annotation) * Math.max(node.scaleX(), node.scaleY())),
      );
      const nextX = node.x();
      const nextY = node.y();
      node.scale({ x: 1, y: 1 });
      node.position({ x: nextX, y: nextY });

      commitAnnotations(
        activeAnnotations.map((item) => (
          item.id === annotationId && item.type === 'text'
            ? {
                ...item,
                geometry: { x: nextX, y: nextY },
                style: {
                  ...item.style,
                  fontSize: nextFontSize,
                },
              }
            : item
        )),
      );
      return;
    }

    if (annotation.type === 'rect' || annotation.type === 'ellipse') {
      const nextX = node.x();
      const nextY = node.y();
      const nextWidth = Math.max(MIN_SHAPE_SIZE, annotation.geometry.width * node.scaleX());
      const nextHeight = Math.max(MIN_SHAPE_SIZE, annotation.geometry.height * node.scaleY());
      node.scale({ x: 1, y: 1 });

      commitAnnotations(
        activeAnnotations.map((item) => (
          item.id === annotationId && item.type === annotation.type
            ? {
                ...item,
                geometry: {
                  x: nextX,
                  y: nextY,
                  width: nextWidth,
                  height: nextHeight,
                },
              }
            : item
        )),
      );
    }
  };

  const updateArrowEndpoint = (annotationId: string, endpoint: 'start' | 'end', x: number, y: number) => {
    commitAnnotations(
      activeAnnotations.map((annotation) => {
        if (annotation.id !== annotationId || annotation.type !== 'arrow') {
          return annotation;
        }

        const [x1, y1, x2, y2] = annotation.geometry.points;
        return {
          ...annotation,
          geometry: {
            points: endpoint === 'start'
              ? [x, y, x2, y2]
              : [x1, y1, x, y],
          },
        };
      }),
    );
  };

  const openTextEditorForAnnotation = (annotation: WorkspaceAnnotation) => {
    if (props.tool === 'pan' || annotation.type !== 'text') {
      return;
    }

    const editorStyle = props.tool === 'text'
      ? textToolStyle
      : getTextStyle(annotation);

    setSelectedAnnotationId(annotation.id);
    const nextEditor = {
      x: annotation.geometry.x,
      y: annotation.geometry.y,
      value: annotation.text,
      annotationId: annotation.id,
      ...editorStyle,
      selectAllOnFocus: true,
    };
    textEditorRef.current = nextEditor;
    setTextEditor(nextEditor);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && !textEditor && selectedAnnotationId) {
        event.preventDefault();
        commitAnnotations(
          activeAnnotations.filter((annotation) => annotation.id !== selectedAnnotationId),
        );
        setSelectedAnnotationId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAnnotations, commitAnnotations, selectedAnnotationId, textEditor]);

  const stageCursor = useMemo(() => {
    if (textEditor) {
      return 'text';
    }

    if (hoverCursor) {
      return hoverCursor;
    }

    if (!hasExplicitToolSelection && !selectedAnnotation) {
      return 'default';
    }

    if (props.tool === 'pan') {
      return isPanningRef.current ? 'grabbing' : 'grab';
    }

    if (props.tool === 'text') {
      return 'text';
    }

    return 'crosshair';
  }, [hasExplicitToolSelection, hoverCursor, props.tool, selectedAnnotation, textEditor]);

  return (
    <section className="canvagent-stage-shell">
      <div className="canvagent-stage-canvas">
        {activeStyleKind
          ? renderStylePanelAnchor(
              props.stylePanelHost,
              <AnnotationStylePanel
                activeStyleKind={activeStyleKind}
                strokeStyle={activeStrokeStyle}
                textStyle={activeTextStyle}
                strokeWidthRange={strokeWidthRange}
                onApplyStrokeStyle={applyStrokeStyle}
                onApplyTextStyle={applyTextStyle}
              />,
            )
          : null}

        <div
          className={`canvagent-stage-surface is-tool-${props.tool} ${isSingleImageStage ? 'is-single-image' : ''}`}
        >
          <div
            ref={stageAreaRef}
            className="canvagent-stage-viewport"
            data-stage-world
            aria-label="Annotation stage"
            style={{ cursor: stageCursor }}
          >
            <Stage
              width={stageSize.width}
              height={stageSize.height}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              onMouseLeave={handleStageMouseLeave}
              onTouchStart={handleStageMouseDown}
              onTouchMove={handleStageMouseMove}
              onTouchEnd={handleStageMouseUp}
              onWheel={handleStageWheel}
            >
              <Layer>
                <Rect width={stageSize.width} height={stageSize.height} fill="#f8fafc" />
                {stageImageLayouts.map((imageLayout) => {
                  const isActive = imageLayout.id === activeImage.id;
                  const isSelectedImageObject = selectedImageObjectIds.includes(imageLayout.id);
                  const enableImageObjectLayer = !isSingleImageStage;

                  return (
                    <Group
                      key={imageLayout.id}
                      x={imageLayout.screenX}
                      y={imageLayout.screenY}
                      scaleX={imageLayout.screenScale}
                      scaleY={imageLayout.screenScale}
                      draggable={enableImageObjectLayer && props.tool === 'pan' && isSelectedImageObject}
                      onMouseDown={(event) => {
                        if (!enableImageObjectLayer) {
                          return;
                        }
                        event.cancelBubble = true;
                        handleSelectImageObject(imageLayout.id);
                      }}
                      onTouchStart={(event) => {
                        if (!enableImageObjectLayer) {
                          return;
                        }
                        event.cancelBubble = true;
                        handleSelectImageObject(imageLayout.id);
                      }}
                      onDragEnd={(event) => {
                        if (!enableImageObjectLayer) {
                          return;
                        }
                        event.cancelBubble = true;
                        handleMoveImageObject(imageLayout.id, event.target.x(), event.target.y());
                      }}
                    >
                      <Rect
                        width={imageLayout.intrinsicWidth}
                        height={imageLayout.intrinsicHeight}
                        fill="#ffffff"
                        stroke={isSelectedImageObject ? '#2563eb' : isSingleImageStage ? 'rgba(148, 163, 184, 0.34)' : isActive ? '#60a5fa' : '#cbd5e1'}
                        strokeWidth={isSelectedImageObject ? 2 / imageLayout.screenScale : isSingleImageStage ? 1 / imageLayout.screenScale : isActive ? 2 / imageLayout.screenScale : 1 / imageLayout.screenScale}
                        cornerRadius={12 / imageLayout.screenScale}
                        shadowColor="rgba(15, 23, 42, 0.12)"
                        shadowBlur={16 / imageLayout.screenScale}
                        shadowOffsetY={6 / imageLayout.screenScale}
                        shadowOpacity={0.18}
                      />
                      {imageLayout.image ? (
                        <KonvaImage
                          image={imageLayout.image}
                          width={imageLayout.intrinsicWidth}
                          height={imageLayout.intrinsicHeight}
                          listening={false}
                        />
                      ) : (
                        <Rect
                          width={imageLayout.intrinsicWidth}
                          height={imageLayout.intrinsicHeight}
                          fill="#e2e8f0"
                        />
                      )}
                      {isActive ? (
                        <>
                          {activeAnnotations.map((annotation) => (
                            <KonvaAnnotation
                              key={annotation.id}
                              annotation={annotation}
                              isSelected={annotation.id === selectedAnnotationId}
                              isEditing={textEditor?.annotationId === annotation.id}
                              tool={props.tool}
                              setNodeRef={(node) => {
                                annotationNodeRefs.current[annotation.id] = node;
                              }}
                              onClick={() => handleSelectAnnotation(annotation.id)}
                              onDrag={(dx, dy) => handleDragAnnotation(annotation, dx, dy)}
                              onTransformEnd={() => handleTransformAnnotation(annotation.id)}
                              onOpenTextEditor={() => openTextEditorForAnnotation(annotation)}
                              onUpdateArrowEndpoint={(endpoint, x, y) => updateArrowEndpoint(annotation.id, endpoint, x, y)}
                            />
                          ))}
                          {draft ? <KonvaAnnotation annotation={draft} isDraft tool={props.tool} /> : null}
                          <Transformer
                            ref={transformerRef}
                            rotateEnabled={false}
                            keepRatio={false}
                            ignoreStroke
                            borderStroke="#2563eb"
                            borderDash={selectedAnnotation?.type === 'text' ? [] : [6, 4]}
                            anchorStroke="#2563eb"
                            anchorFill="#ffffff"
                            anchorSize={7}
                            enabledAnchors={[
                              'top-left',
                              'top-center',
                              'top-right',
                              'middle-left',
                              'middle-right',
                              'bottom-left',
                              'bottom-center',
                              'bottom-right',
                            ]}
                            resizeEnabled={!!selectedAnnotation && props.tool !== 'pan'}
                            boundBoxFunc={(oldBox: any, newBox: any) => {
                              if (newBox.width < MIN_SHAPE_SIZE || newBox.height < MIN_SHAPE_SIZE) {
                                return oldBox;
                              }
                              return newBox;
                            }}
                          />
                        </>
                      ) : null}
                    </Group>
                  );
                })}
              </Layer>
            </Stage>

            <div className="canvagent-stage-world-layer">
              {stageImageLayouts.map((imageLayout) => {
                const isActive = imageLayout.id === activeImage.id;
                const isSelectedImageObject = selectedImageObjectIds.includes(imageLayout.id);
                const label = getStageImageLabel(imageLayout);

                return (
                    <div
                      key={`${imageLayout.id}-overlay`}
                      className="canvagent-stage-image-item"
                      data-stage-image-item
                      data-image-id={imageLayout.id}
                      data-active={String(isActive)}
                      data-object-x={String(Math.round(imageLayout.worldX))}
                      data-object-y={String(Math.round(imageLayout.worldY))}
                    >
                    {!isSingleImageStage ? (
                      <span
                        className="canvagent-stage-image-name"
                        title={label}
                        style={{
                          left: `${imageLayout.titleX}px`,
                          top: `${imageLayout.titleY}px`,
                          width: `${imageLayout.screenWidth}px`,
                        }}
                      >
                        {label}
                      </span>
                    ) : null}
                    {!isActive ? (
                      <button
                        type="button"
                        className="canvagent-stage-image-activation"
                        aria-label={`Activate image ${label}`}
                        data-move-handle={label}
                        onClick={() => props.onSelectImage?.(imageLayout.id)}
                        style={{
                          left: `${imageLayout.screenX}px`,
                          top: `${imageLayout.screenY}px`,
                          width: `${imageLayout.screenWidth}px`,
                          height: `${imageLayout.screenHeight}px`,
                        }}
                      />
                    ) : null}
                    {props.tool === 'pan' && isSelectedImageObject ? (
                      <button
                        type="button"
                        className="canvagent-stage-image-drag-handle"
                        aria-label={`Move image ${label}`}
                        style={{
                          left: `${imageLayout.screenX}px`,
                          top: `${imageLayout.screenY}px`,
                          width: `${imageLayout.screenWidth}px`,
                          height: `${imageLayout.screenHeight}px`,
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className={`canvagent-stage-zoom-chip ${isSingleImageStage ? 'is-single-image' : ''}`}>{Math.round(zoomRatio * 100)}%</div>

            {textEditor && textEditorPixelStyle ? (
              <textarea
                ref={textInputRef}
                aria-label="Annotation text"
                className="canvagent-stage-text-editor"
                autoFocus
                spellCheck={false}
                wrap="off"
                style={{
                  left: `${textEditorPixelStyle.left}px`,
                  top: `${textEditorPixelStyle.top}px`,
                  width: `${textEditorPixelStyle.width}px`,
                  fontSize: `${textEditorPixelStyle.fontSize}px`,
                  lineHeight: `${textEditorPixelStyle.lineHeight}px`,
                  color: getEffectiveTextColor(textEditor),
                  backgroundColor: textEditor.fillEnabled ? textEditor.fill : 'transparent',
                  caretColor: getEffectiveTextColor(textEditor),
                  borderColor: textEditor.fillEnabled ? getEffectiveTextColor(textEditor) : textEditor.color,
                }}
                value={textEditor.value}
                onChange={(event) => setTextEditor((previous) => {
                  if (!previous) {
                    return previous;
                  }

                  const nextEditor = { ...previous, value: event.target.value };
                  textEditorRef.current = nextEditor;
                  return nextEditor;
                })}
                onFocus={(event) => {
                  if (textEditor.selectAllOnFocus) {
                    event.currentTarget.setSelectionRange(0, event.currentTarget.value.length);
                    setTextEditor((previous) => (
                      previous ? { ...previous, selectAllOnFocus: false } : previous
                    ));
                  }
                  event.currentTarget.style.height = '0px';
                  event.currentTarget.style.height = `${Math.max(28, event.currentTarget.scrollHeight)}px`;
                }}
                onBlur={() => commitTextEditorValue(getLiveTextEditor())}
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    commitTextEditorValue(getLiveTextEditor());
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    textEditorRef.current = null;
                    setTextEditor(null);
                  }
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function KonvaAnnotation(props: {
  annotation: WorkspaceAnnotation;
  isSelected?: boolean;
  isEditing?: boolean;
  isDraft?: boolean;
  tool: AnnotationTool;
  setNodeRef?: (node: any) => void;
  onClick?: () => void;
  onDrag?: (dx: number, dy: number) => void;
  onTransformEnd?: () => void;
  onOpenTextEditor?: () => void;
  onUpdateArrowEndpoint?: (endpoint: 'start' | 'end', x: number, y: number) => void;
}) {
  const { annotation } = props;
  const showSelectedState = props.isSelected && props.tool !== 'pan';
  const commonProps = {
    listening: !props.isDraft,
    draggable: !props.isDraft && props.tool !== 'pan' && !props.isEditing,
    onClick: () => props.onClick?.(),
    onTap: () => props.onClick?.(),
    onMouseDown: (event: any) => {
      event.cancelBubble = true;
    },
    onTouchStart: (event: any) => {
      event.cancelBubble = true;
    },
  };

  if (annotation.type === 'brush' || annotation.type === 'highlight') {
    return (
      <Line
        {...commonProps}
        name="annotation-shape"
        points={annotation.geometry.points}
        stroke={getStrokeColor(annotation)}
        strokeWidth={getStrokeWidth(annotation)}
        hitStrokeWidth={24}
        lineCap="round"
        lineJoin="round"
        tension={0.2}
        opacity={annotation.type === 'highlight' ? 0.35 : 1}
        shadowColor={showSelectedState ? '#2563eb' : undefined}
        shadowBlur={showSelectedState ? 10 : 0}
        onDragEnd={(event) => {
          const node = event.target;
          const dx = node.x();
          const dy = node.y();
          node.position({ x: 0, y: 0 });
          props.onDrag?.(dx, dy);
        }}
      />
    );
  }

  if (annotation.type === 'rect') {
    return (
      <Group
        {...commonProps}
        ref={props.setNodeRef}
        x={annotation.geometry.x}
        y={annotation.geometry.y}
        onTransformEnd={props.onTransformEnd}
        onDragEnd={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          const node = event.currentTarget;
          props.onDrag?.(
            node.x() - annotation.geometry.x,
            node.y() - annotation.geometry.y,
          );
        }}
      >
        <Rect
          name="annotation-shape"
          width={annotation.geometry.width}
          height={annotation.geometry.height}
          stroke={getStrokeColor(annotation)}
          strokeWidth={getStrokeWidth(annotation)}
          hitStrokeWidth={20}
          shadowColor={showSelectedState ? '#2563eb' : undefined}
          shadowBlur={showSelectedState ? 10 : 0}
        />
      </Group>
    );
  }

  if (annotation.type === 'ellipse') {
    return (
      <Group
        {...commonProps}
        ref={props.setNodeRef}
        x={annotation.geometry.x}
        y={annotation.geometry.y}
        onTransformEnd={props.onTransformEnd}
        onDragEnd={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          const node = event.currentTarget;
          props.onDrag?.(
            node.x() - annotation.geometry.x,
            node.y() - annotation.geometry.y,
          );
        }}
      >
        <Ellipse
          name="annotation-shape"
          x={annotation.geometry.width / 2}
          y={annotation.geometry.height / 2}
          radiusX={annotation.geometry.width / 2}
          radiusY={annotation.geometry.height / 2}
          stroke={getStrokeColor(annotation)}
          strokeWidth={getStrokeWidth(annotation)}
          hitStrokeWidth={20}
          shadowColor={showSelectedState ? '#2563eb' : undefined}
          shadowBlur={showSelectedState ? 10 : 0}
        />
      </Group>
    );
  }

  if (annotation.type === 'arrow') {
    const [x1, y1, x2, y2] = annotation.geometry.points;
    const endpointCursor = getArrowEndpointCursor(annotation.geometry.points);

    return (
      <Group
        {...commonProps}
        onDragEnd={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          const node = event.currentTarget;
          const dx = node.x();
          const dy = node.y();
          node.position({ x: 0, y: 0 });
          props.onDrag?.(dx, dy);
        }}
      >
        <Arrow
          name="annotation-shape"
          points={annotation.geometry.points}
          stroke={getStrokeColor(annotation)}
          fill={getStrokeColor(annotation)}
          strokeWidth={getStrokeWidth(annotation)}
          hitStrokeWidth={24}
          pointerLength={18}
          pointerWidth={18}
          shadowColor={showSelectedState ? '#2563eb' : undefined}
          shadowBlur={showSelectedState ? 10 : 0}
        />
        {showSelectedState && !props.isDraft ? (
          <>
            <Circle
              name="arrow-endpoint"
              endpointCursor={endpointCursor}
              x={x1}
              y={y1}
              radius={7}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={2}
              draggable
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
                props.onUpdateArrowEndpoint?.('start', event.target.x(), event.target.y());
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                props.onUpdateArrowEndpoint?.('start', event.target.x(), event.target.y());
              }}
            />
            <Circle
              name="arrow-endpoint"
              endpointCursor={endpointCursor}
              x={x2}
              y={y2}
              radius={7}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={2}
              draggable
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
                props.onUpdateArrowEndpoint?.('end', event.target.x(), event.target.y());
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                props.onUpdateArrowEndpoint?.('end', event.target.x(), event.target.y());
              }}
            />
          </>
        ) : null}
      </Group>
    );
  }

  if (annotation.type === 'text') {
    const textStyle = getTextStyle(annotation);
    const textBounds = measureTextBounds(annotation.text, textStyle.fontSize);
    const backgroundWidth = textBounds.width + 16;
    const backgroundHeight = textBounds.height + 12;

    return (
      <Group
        {...commonProps}
        ref={props.setNodeRef}
        x={annotation.geometry.x}
        y={annotation.geometry.y}
        onTransformEnd={props.onTransformEnd}
        onDblClick={() => props.onOpenTextEditor?.()}
        onDblTap={() => props.onOpenTextEditor?.()}
        onDragEnd={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          const node = event.currentTarget;
          props.onDrag?.(
            node.x() - annotation.geometry.x,
            node.y() - annotation.geometry.y,
          );
        }}
      >
        <Rect
          name="annotation-shape"
          x={-8}
          y={-6}
          width={backgroundWidth}
          height={backgroundHeight}
          fill={textStyle.fillEnabled ? textStyle.fill : 'rgba(255,255,255,0.001)'}
          cornerRadius={4}
        />
        {!props.isEditing ? (
          <KonvaText
            name="annotation-shape"
            text={annotation.text}
            fontSize={textStyle.fontSize}
            fontStyle="bold"
            lineHeight={1.28}
            fill={getEffectiveTextColor(textStyle)}
            shadowColor={showSelectedState ? '#2563eb' : undefined}
            shadowBlur={showSelectedState ? 8 : 0}
          />
        ) : null}
      </Group>
    );
  }

  return null;
}

function DomFallbackAnnotationStage(props: AnnotationStageProps) {
  const hasExplicitToolSelection = props.hasExplicitToolSelection ?? false;
  const stageImages = useMemo(
    () => getStageImages(props),
    [props.images, props.image.id, props.image.src, props.image.title],
  );
  const isSingleImageStage = stageImages.length === 1;
  const activeImageId = props.activeImageId ?? props.image.id;
  const activeImage = stageImages.find((image) => image.id === activeImageId) ?? stageImages[0]!;
  const activeAnnotations = props.annotationsByImageId?.[activeImage.id] ?? props.annotations;
  const selectedImageObjectIds = props.selectedImageObjectIds ?? [];
  const [draft, setDraft] = useState<WorkspaceAnnotation | null>(null);
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [loadedImages, setLoadedImages] = useState<LoadedImageMap>({});
  const [stageSize, setStageSize] = useState({ width: 1, height: 1 });
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [sharedStrokeColor, setSharedStrokeColor] = useState(SHAPE_STROKE);
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(SHAPE_STROKE_WIDTH);
  const [brushStrokeWidth, setBrushStrokeWidth] = useState(BRUSH_STROKE_WIDTH);
  const [textToolStyle, setTextToolStyle] = useState<TextStyleValue>({
    color: TEXT_COLOR,
    fontSize: TEXT_SIZE,
    fill: '#ffffff',
    fillEnabled: false,
  });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const textEditorRef = useRef<TextEditorState | null>(null);
  const textCommitInFlightRef = useRef(false);
  const requestedImageSrcRef = useRef<Record<string, string>>({});
  const pendingTextPlacementRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextTextPlacementRef = useRef(false);
  const resizeDragRef = useRef<ResizeDragState | null>(null);
  const draggedImageRef = useRef<{
    imageId: string;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    stageImages.forEach((stageImage) => {
      if (requestedImageSrcRef.current[stageImage.id] === stageImage.src) {
        return;
      }

      requestedImageSrcRef.current[stageImage.id] = stageImage.src;
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        setLoadedImages((previous) => ({
          ...previous,
          [stageImage.id]: {
            image,
            width: image.naturalWidth || image.width || 1,
            height: image.naturalHeight || image.height || 1,
          },
        }));
      };
      image.onerror = () => {
        if (cancelled) return;
        setLoadedImages((previous) => ({
          ...previous,
          [stageImage.id]: { image: null, width: 1, height: 1 },
        }));
      };
      image.src = stageImage.src;
    });

    return () => {
      cancelled = true;
    };
  }, [stageImages]);

  useEffect(() => {
    if (!stageRef.current) return undefined;

    const rect = stageRef.current.getBoundingClientRect();
    setStageSize({
      width: Math.max(1, Math.round(rect.width || STAGE_WIDTH)),
      height: Math.max(1, Math.round(rect.height || STAGE_HEIGHT)),
    });

    return undefined;
  }, []);

  useEffect(() => {
    if (props.tool !== 'pan') {
      return;
    }

    setSelectedAnnotationId(null);
    textEditorRef.current = null;
    setTextEditor(null);
  }, [props.tool]);

  useEffect(() => {
    textEditorRef.current = textEditor;
  }, [textEditor]);

  const selectedAnnotation = activeAnnotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;

  const stageImageLayouts = useMemo(() => buildStageImageLayouts({
    stageImages,
    imageObjectsById: props.imageObjectsById,
    loadedImages,
    stageSize,
    zoomRatio: 1,
    viewOffset: { x: 0, y: 0 },
  }), [loadedImages, props.imageObjectsById, stageImages, stageSize]);

  const activeStageImageLayout = stageImageLayouts.find((image) => image.id === activeImage.id) ?? {
    ...activeImage,
    image: null,
    intrinsicWidth: 1,
    intrinsicHeight: 1,
    worldX: 0,
    worldY: 0,
    worldWidth: 1,
    worldHeight: 1,
    screenX: STAGE_PADDING,
    screenY: STAGE_PADDING + STAGE_TITLE_HEIGHT + STAGE_TITLE_GAP,
    screenWidth: 1,
    screenHeight: 1,
    screenScale: 1,
    titleX: STAGE_PADDING,
    titleY: STAGE_PADDING,
  };

  const imageLayout = useMemo(() => ({
    x: activeStageImageLayout.screenX,
    y: activeStageImageLayout.screenY,
    width: activeStageImageLayout.screenWidth,
    height: activeStageImageLayout.screenHeight,
    scale: activeStageImageLayout.screenScale,
  }), [activeStageImageLayout]);

  const activeStyleKind = useMemo(() => {
    if (textEditor) {
      return 'text';
    }

    if (hasExplicitToolSelection && props.tool !== 'pan') {
      return getToolStyleKind(props.tool);
    }

    return null;
  }, [hasExplicitToolSelection, props.tool, textEditor]);

  const activeStrokeStyle = useMemo<StrokeStyleValue | null>(() => {
    if (!activeStyleKind || activeStyleKind === 'text') {
      return null;
    }

    return {
      stroke: sharedStrokeColor,
      strokeWidth: activeStyleKind === 'brush' ? brushStrokeWidth : shapeStrokeWidth,
    };
  }, [activeStyleKind, brushStrokeWidth, shapeStrokeWidth, sharedStrokeColor]);

  const activeTextStyle = useMemo<TextStyleValue | null>(() => {
    if (textEditor) {
      return getTextStyle(textEditor);
    }

    if (activeStyleKind === 'text') {
      return textToolStyle;
    }

    return null;
  }, [activeStyleKind, textEditor, textToolStyle]);

  const strokeWidthRange = useMemo(() => (
    activeStyleKind === 'brush' ? BRUSH_STROKE_WIDTH_RANGE : SHAPE_STROKE_WIDTH_RANGE
  ), [activeStyleKind]);

  const commitTextEditorValue = (editor: TextEditorState | null) => {
    if (textCommitInFlightRef.current) {
      return;
    }

    textCommitInFlightRef.current = true;
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        textCommitInFlightRef.current = false;
      });
    } else {
      setTimeout(() => {
        textCommitInFlightRef.current = false;
      }, 0);
    }

    if (!editor) {
      textEditorRef.current = null;
      setTextEditor(null);
      return;
    }

    const currentEditor = editor!;
    const nextText = currentEditor.value.replace(/\r\n/g, '\n');
    if (!nextText.trim()) {
      if (currentEditor.annotationId) {
        props.onCommitAnnotations(
          activeAnnotations.filter((annotation) => annotation.id !== currentEditor.annotationId),
        );
      }
      textEditorRef.current = null;
      setTextEditor(null);
      return;
    }

    if (currentEditor.annotationId) {
      props.onCommitAnnotations(
        activeAnnotations.map((annotation) => (
          annotation.id === currentEditor.annotationId && annotation.type === 'text'
            ? {
                ...annotation,
                text: nextText,
                geometry: { x: currentEditor.x, y: currentEditor.y },
                style: {
                  ...annotation.style,
                  color: currentEditor.color,
                  fontSize: currentEditor.fontSize,
                  fill: currentEditor.fill,
                  fillEnabled: currentEditor.fillEnabled,
                },
              }
            : annotation
        )),
      );
      textEditorRef.current = null;
      setTextEditor(null);
      return;
    }

    props.onCommitAnnotations([
      ...activeAnnotations,
      createTextAnnotation({
        id: `text-${Date.now()}`,
        x: currentEditor.x,
        y: currentEditor.y,
        text: nextText,
        color: currentEditor.color,
        fontSize: currentEditor.fontSize,
        fill: currentEditor.fill,
        fillEnabled: currentEditor.fillEnabled,
      }),
    ]);
    textEditorRef.current = null;
    setTextEditor(null);
  };

  const syncSharedStrokeColor = (color: string) => {
    setSharedStrokeColor(color);
    setTextToolStyle((previous) => resolveNextTextStyle(previous, { color }));
  };

  const applyStrokeStyle = (patch: Partial<StrokeStyleValue>) => {
    if (hasExplicitToolSelection && activeStyleKind && activeStyleKind !== 'text') {
      if (patch.stroke !== undefined) {
        syncSharedStrokeColor(patch.stroke);
      }

      if (patch.strokeWidth !== undefined) {
        if (activeStyleKind === 'brush') {
          setBrushStrokeWidth(patch.strokeWidth);
        } else {
          setShapeStrokeWidth(patch.strokeWidth);
        }
      }
      return;
    }

    if (selectedAnnotation && isStrokeAnnotation(selectedAnnotation)) {
      props.onCommitAnnotations(
        activeAnnotations.map((annotation) => (
          annotation.id === selectedAnnotation.id && annotation.type !== 'text'
            ? {
                ...annotation,
                style: {
                  ...annotation.style,
                  stroke: patch.stroke ?? getStrokeColor(annotation),
                  strokeWidth: patch.strokeWidth ?? getStrokeWidth(annotation),
                },
              }
            : annotation
        )),
      );
    }
  };

  const applyTextStyle = (patch: Partial<TextStyleValue>) => {
    if (textEditor) {
      if (hasExplicitToolSelection && props.tool === 'text') {
        if (patch.color && !(patch.fillEnabled ?? textEditor.fillEnabled)) {
          syncSharedStrokeColor(patch.color);
        }
        setTextToolStyle((previous) => resolveNextTextStyle(previous, patch));
      }
      setTextEditor((previous) => (
        previous ? { ...previous, ...resolveNextTextStyle(previous, patch) } : previous
      ));
      return;
    }

    if (hasExplicitToolSelection && props.tool === 'text') {
      if (patch.color && !patch.fillEnabled && !textToolStyle.fillEnabled) {
        syncSharedStrokeColor(patch.color);
      }
      setTextToolStyle((previous) => resolveNextTextStyle(previous, patch));
      return;
    }

    if (selectedAnnotation?.type === 'text') {
      props.onCommitAnnotations(
        activeAnnotations.map((annotation) => (
          annotation.id === selectedAnnotation.id && annotation.type === 'text'
            ? {
                ...annotation,
                style: {
                  ...annotation.style,
                  ...resolveNextTextStyle(getTextStyle(annotation), patch),
                },
              }
            : annotation
        )),
      );
    }
  };

  const getLiveTextEditor = () => {
    const editor = textEditorRef.current;
    if (!editor) {
      return null;
    }

    const input = textInputRef.current;
    if (!input) {
      return editor;
    }

    const nextEditor = { ...editor, value: input.value };
    textEditorRef.current = nextEditor;
    return nextEditor;
  };

  const handleSelectImageObject = (imageId: string) => {
    props.onSelectImage?.(imageId);
    setSelectedAnnotationId(null);
    textEditorRef.current = null;
    setTextEditor(null);
  };

  const handleImagePointerDown = (
    imageId: string,
    event: MouseEvent<HTMLButtonElement | HTMLDivElement>,
  ) => {
    event.stopPropagation();
    const imageObject = props.imageObjectsById?.[imageId];
    handleSelectImageObject(imageId);

    if (props.tool !== 'pan' || !props.onMoveImageObject) {
      return;
    }

    draggedImageRef.current = {
      imageId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: imageObject?.x ?? 0,
      originY: imageObject?.y ?? 0,
    };
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressNextTextPlacementRef.current) {
      suppressNextTextPlacementRef.current = false;
      return;
    }

    if (textEditorRef.current) {
      commitTextEditorValue(getLiveTextEditor());
      pendingTextPlacementRef.current = null;
      return;
    }

    const point = getImagePoint(event, imageLayout);
    if (!point) return;

    if (props.tool === 'text') {
      setSelectedAnnotationId(null);
      pendingTextPlacementRef.current = point;
      return;
    }

    const shapeTool = getShapeTool(props.tool);
    if (!shapeTool) {
      return;
    }

    setDraft(createDraftAnnotation(shapeTool, point, {
      stroke: sharedStrokeColor,
      strokeWidth: shapeTool === 'brush' ? brushStrokeWidth : shapeStrokeWidth,
    }));
    setDraftStart(point);
  };

  useEffect(() => {
    if (!textEditor) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const input = textInputRef.current;
      if (!input) {
        return;
      }
      if (event.target instanceof Node && input.contains(event.target)) {
        return;
      }
      suppressNextTextPlacementRef.current = true;
      commitTextEditorValue(getLiveTextEditor());
      pendingTextPlacementRef.current = null;
    };

    const handleMouseDownCapture = (event: globalThis.MouseEvent) => {
      const input = textInputRef.current;
      if (!input) {
        return;
      }
      if (event.target instanceof Node && input.contains(event.target)) {
        return;
      }
      suppressNextTextPlacementRef.current = true;
      commitTextEditorValue(getLiveTextEditor());
      pendingTextPlacementRef.current = null;
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('mousedown', handleMouseDownCapture, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('mousedown', handleMouseDownCapture, true);
    };
  }, [commitTextEditorValue, textEditor]);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (resizeDragRef.current) {
      const rect = event.currentTarget.getBoundingClientRect();
      const point = getImagePointFromClientPosition(event.clientX, event.clientY, rect, imageLayout);
      if (!point) {
        return;
      }

      const resizeDrag = resizeDragRef.current;
      const nextGeometry = getResizedGeometryFromHandle(
        resizeDrag.startGeometry,
        resizeDrag.handle,
        point,
      );

      props.onCommitAnnotations(
        activeAnnotations.map((annotation) => (
          annotation.id === resizeDrag.annotationId && annotation.type === resizeDrag.annotationType
            ? {
                ...annotation,
                geometry: nextGeometry,
              }
            : annotation
        )),
      );
      return;
    }

    if (draggedImageRef.current && props.onMoveImageObject) {
      const drag = draggedImageRef.current;
      props.onMoveImageObject(
        drag.imageId,
        drag.originX + (event.clientX - drag.startClientX),
        drag.originY + (event.clientY - drag.startClientY),
      );
      return;
    }

    if (!draft || !draftStart) return;
    const point = getImagePoint(event, imageLayout);
    if (!point) return;
    setDraft(updateDraftAnnotation(draft, draftStart, point));
  };

  const handleMouseUp = () => {
    if (resizeDragRef.current) {
      resizeDragRef.current = null;
      return;
    }

    if (draggedImageRef.current) {
      draggedImageRef.current = null;
      return;
    }

    if (props.tool === 'text') {
      const pendingTextPlacement = pendingTextPlacementRef.current;
      pendingTextPlacementRef.current = null;
      if (pendingTextPlacement) {
        const nextEditor = {
          x: pendingTextPlacement.x,
          y: pendingTextPlacement.y,
          value: '',
          annotationId: null,
          ...textToolStyle,
        };
        textEditorRef.current = nextEditor;
        setTextEditor(nextEditor);
      }
      return;
    }

    if (!draft) return;
    if (!isDrawableAnnotation(draft)) {
      setDraft(null);
      setDraftStart(null);
      return;
    }
    props.onCommitAnnotations([...activeAnnotations, draft]);
    setDraft(null);
    setDraftStart(null);
  };

  const openTextEditorForAnnotation = (annotation: WorkspaceAnnotation) => {
    if (props.tool === 'pan' || annotation.type !== 'text') {
      return;
    }

    const editorStyle = props.tool === 'text'
      ? textToolStyle
      : getTextStyle(annotation);

    setSelectedAnnotationId(annotation.id);
    const nextEditor = {
      x: annotation.geometry.x,
      y: annotation.geometry.y,
      value: annotation.text,
      annotationId: annotation.id,
      ...editorStyle,
      selectAllOnFocus: true,
    };
    textEditorRef.current = nextEditor;
    setTextEditor(nextEditor);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && !textEditor && selectedAnnotationId) {
        event.preventDefault();
        props.onCommitAnnotations(
          activeAnnotations.filter((annotation) => annotation.id !== selectedAnnotationId),
        );
        setSelectedAnnotationId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAnnotations, props.onCommitAnnotations, selectedAnnotationId, textEditor]);

  return (
    <section className="canvagent-stage-shell">
      <div className="canvagent-stage-canvas">
        {activeStyleKind
          ? renderStylePanelAnchor(
              props.stylePanelHost,
              <AnnotationStylePanel
                activeStyleKind={activeStyleKind}
                strokeStyle={activeStrokeStyle}
                textStyle={activeTextStyle}
                strokeWidthRange={strokeWidthRange}
                onApplyStrokeStyle={applyStrokeStyle}
                onApplyTextStyle={applyTextStyle}
              />,
            )
          : null}

        <div
          className={`canvagent-stage-surface is-tool-${props.tool} ${isSingleImageStage ? 'is-single-image' : ''}`}
        >
          <div
            ref={stageRef}
            className="canvagent-stage-viewport"
            data-stage-world
            aria-label="Annotation stage"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {stageImageLayouts.map((stageImage) => {
              const isActive = stageImage.id === activeImage.id;
              const label = getStageImageLabel(stageImage);

              return (
                <div
                  key={stageImage.id}
                  className="canvagent-stage-image-item"
                  data-stage-image-item
                  data-image-id={stageImage.id}
                  data-active={String(isActive)}
                  data-object-x={String(Math.round(stageImage.worldX))}
                  data-object-y={String(Math.round(stageImage.worldY))}
                >
                  {!isSingleImageStage ? (
                    <span
                      className="canvagent-stage-image-name"
                      title={label}
                      style={{
                        left: `${stageImage.titleX}px`,
                        top: `${stageImage.titleY}px`,
                        width: `${stageImage.screenWidth}px`,
                      }}
                    >
                      {label}
                    </span>
                  ) : null}

                  {isActive ? (
                    <div
                      className={`canvagent-stage-image-frame is-active ${isSingleImageStage ? 'is-single-image' : ''}`}
                      style={{
                        left: `${imageLayout.x}px`,
                        top: `${imageLayout.y}px`,
                        width: `${imageLayout.width}px`,
                        height: `${imageLayout.height}px`,
                      }}
                      onMouseDown={props.tool === 'pan' ? (event) => handleImagePointerDown(stageImage.id, event) : undefined}
                    >
                      <img className="canvagent-stage-image" src={activeImage.src} alt={getStageImageLabel(activeImage)} />
                      <svg
                        className="canvagent-stage-overlay"
                        viewBox={`0 0 ${activeStageImageLayout.intrinsicWidth} ${activeStageImageLayout.intrinsicHeight}`}
                        aria-hidden="true"
                      >
                        {activeAnnotations.map((annotation) => renderAnnotation(annotation))}
                        {draft ? renderAnnotation(draft) : null}
                      </svg>
                      <div className="canvagent-stage-dom-hit-layer">
                        {activeAnnotations.map((annotation) => (
                          <AnnotationHitTarget
                            key={annotation.id}
                            annotation={annotation}
                            imageLayout={imageLayout}
                            selected={annotation.id === selectedAnnotationId}
                            tool={props.tool}
                            onSelect={() => {
                              if (props.tool === 'pan') {
                                setSelectedAnnotationId(null);
                                textEditorRef.current = null;
                                setTextEditor(null);
                                return;
                              }

                              setSelectedAnnotationId(annotation.id);
                              textEditorRef.current = null;
                              setTextEditor(null);
                            }}
                            onOpenTextEditor={() => openTextEditorForAnnotation(annotation)}
                          />
                        ))}
                        {selectedAnnotation && isTransformable(selectedAnnotation) ? (
                          <ResizeHandleOverlay
                            annotation={selectedAnnotation}
                            imageLayout={imageLayout}
                            onResizeStart={(handle) => {
                              if (selectedAnnotation.type !== 'rect' && selectedAnnotation.type !== 'ellipse') {
                                return;
                              }

                              resizeDragRef.current = {
                                annotationId: selectedAnnotation.id,
                                annotationType: selectedAnnotation.type,
                                handle,
                                startGeometry: {
                                  x: selectedAnnotation.geometry.x,
                                  y: selectedAnnotation.geometry.y,
                                  width: selectedAnnotation.geometry.width,
                                  height: selectedAnnotation.geometry.height,
                                },
                              };
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="canvagent-stage-reference-image"
                      aria-label={`Activate image ${label}`}
                      onMouseDown={(event) => handleImagePointerDown(stageImage.id, event)}
                      onClick={() => props.onSelectImage?.(stageImage.id)}
                      style={{
                        left: `${stageImage.screenX}px`,
                        top: `${stageImage.screenY}px`,
                        width: `${stageImage.screenWidth}px`,
                        height: `${stageImage.screenHeight}px`,
                      }}
                    >
                      <img className="canvagent-stage-image" src={stageImage.src} alt={label} />
                    </button>
                  )}
                  {props.tool === 'pan' && selectedImageObjectIds.includes(stageImage.id) ? (
                    <button
                      type="button"
                      className="canvagent-stage-image-drag-handle"
                      aria-label={`Move image ${label}`}
                      onMouseDown={(event) => handleImagePointerDown(stageImage.id, event)}
                      style={{
                        left: `${stageImage.screenX}px`,
                        top: `${stageImage.screenY}px`,
                        width: `${stageImage.screenWidth}px`,
                        height: `${stageImage.screenHeight}px`,
                      }}
                    />
                  ) : null}
                </div>
              );
            })}

            <div className={`canvagent-stage-zoom-chip ${isSingleImageStage ? 'is-single-image' : ''}`}>100%</div>
            {textEditor ? (
              <textarea
                ref={textInputRef}
                aria-label="Annotation text"
                className="canvagent-stage-text-editor"
                autoFocus
                spellCheck={false}
                wrap="off"
                style={{
                  left: `${imageLayout.x + textEditor.x * imageLayout.scale}px`,
                  top: `${imageLayout.y + textEditor.y * imageLayout.scale}px`,
                  color: getEffectiveTextColor(textEditor),
                  backgroundColor: textEditor.fillEnabled ? textEditor.fill : 'transparent',
                  caretColor: getEffectiveTextColor(textEditor),
                  borderColor: textEditor.fillEnabled ? getEffectiveTextColor(textEditor) : textEditor.color,
                }}
                value={textEditor.value}
                onChange={(event) => setTextEditor((previous) => {
                  if (!previous) {
                    return previous;
                  }

                  const nextEditor = { ...previous, value: event.target.value };
                  textEditorRef.current = nextEditor;
                  return nextEditor;
                })}
                onFocus={(event) => {
                  if (textEditor.selectAllOnFocus) {
                    event.currentTarget.setSelectionRange(0, event.currentTarget.value.length);
                    setTextEditor((previous) => (
                      previous ? { ...previous, selectAllOnFocus: false } : previous
                    ));
                  }
                  event.currentTarget.style.height = '0px';
                  event.currentTarget.style.height = `${Math.max(28, event.currentTarget.scrollHeight)}px`;
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => commitTextEditorValue(getLiveTextEditor())}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    commitTextEditorValue(getLiveTextEditor());
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    textEditorRef.current = null;
                    setTextEditor(null);
                  }
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function AnnotationStylePanel(props: {
  activeStyleKind: StyleKind;
  strokeStyle: StrokeStyleValue | null;
  textStyle: TextStyleValue | null;
  strokeWidthRange: { min: number; max: number };
  onApplyStrokeStyle: (patch: Partial<StrokeStyleValue>) => void;
  onApplyTextStyle: (patch: Partial<TextStyleValue>) => void;
}) {
  const activeTextStyle = props.textStyle;
  const fontSizeMenuRef = useRef<HTMLDivElement | null>(null);
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] = useState(false);

  useEffect(() => {
    if (props.activeStyleKind !== 'text' || !activeTextStyle) {
      setIsFontSizeMenuOpen(false);
    }
  }, [activeTextStyle, props.activeStyleKind]);

  useEffect(() => {
    if (!isFontSizeMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (fontSizeMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsFontSizeMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFontSizeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFontSizeMenuOpen]);

  return (
    <div className="canvagent-stage-style-panel">
      {props.activeStyleKind === 'text' && activeTextStyle ? (
        <>
          <TextFillToggleButton
            active={activeTextStyle.fillEnabled}
            label="Text fill"
            onClick={() => props.onApplyTextStyle({ fillEnabled: !activeTextStyle.fillEnabled })}
          />
          <div className="canvagent-style-font-size-wrap" ref={fontSizeMenuRef}>
            <button
              type="button"
              className="canvagent-style-font-size"
              aria-label="Font size"
              title="Font size"
              aria-haspopup="listbox"
              aria-expanded={isFontSizeMenuOpen}
              onClick={() => setIsFontSizeMenuOpen((current) => !current)}
            >
              <span className="canvagent-style-font-size-value">{activeTextStyle.fontSize}</span>
              <span
                className={`canvagent-style-font-size-chevron ${isFontSizeMenuOpen ? 'is-open' : ''}`}
                aria-hidden="true"
              >
                <FontSizeChevronIcon />
              </span>
            </button>

            {isFontSizeMenuOpen ? (
              <div className="canvagent-style-font-size-menu" role="listbox" aria-label="Font size options">
                {TEXT_SIZE_OPTIONS.map((fontSize) => {
                  const isActive = activeTextStyle.fontSize === fontSize;

                  return (
                    <button
                      key={fontSize}
                      type="button"
                      className={`canvagent-style-font-size-option ${isActive ? 'is-active' : ''}`}
                      onClick={() => {
                        props.onApplyTextStyle({ fontSize });
                        setIsFontSizeMenuOpen(false);
                      }}
                    >
                      <span>{fontSize}</span>
                      <span
                        className={`canvagent-style-font-size-option-check ${isActive ? 'is-visible' : ''}`}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </>
      ) : props.strokeStyle ? (
        <StrokeWidthControl
          color={props.strokeStyle.stroke}
          min={props.strokeWidthRange.min}
          max={props.strokeWidthRange.max}
          value={props.strokeStyle.strokeWidth}
          onChange={(strokeWidth) => props.onApplyStrokeStyle({ strokeWidth })}
        />
      ) : null}

      <span className="canvagent-style-divider" aria-hidden="true" />

      {COLOR_PALETTE.map((color) => {
        const isActive = props.activeStyleKind === 'text' && props.textStyle
          ? (
            props.textStyle.fillEnabled
              ? props.textStyle.fill === color
              : props.textStyle.color === color
          )
          : props.strokeStyle?.stroke === color;

        return (
          <ColorSwatchButton
            key={color}
            active={!!isActive}
            color={color}
            label={`Annotation color ${color}`}
            onClick={() => {
              if (props.activeStyleKind === 'text') {
                if (props.textStyle?.fillEnabled) {
                  props.onApplyTextStyle({ fill: color });
                  return;
                }

                props.onApplyTextStyle({ color });
                return;
              }

              props.onApplyStrokeStyle({ stroke: color });
            }}
          />
        );
      })}
    </div>
  );
}

function FontSizeChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" focusable="false">
      <path
        d="M4 6.5 8 10.5 12 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ColorSwatchButton(props: {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="canvagent-style-swatch"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      <span
        className={`canvagent-style-swatch-dot ${props.active ? 'is-active' : ''}`}
        style={{
          backgroundColor: props.color,
          boxShadow: props.color === '#ffffff' ? 'inset 0 0 0 1px rgba(148,163,184,0.55)' : undefined,
          color: props.color === '#ffffff' || props.color === '#f59e0b' || props.color === '#22c55e' ? '#111827' : '#ffffff',
        }}
      >
        {props.active ? '✓' : ''}
      </span>
    </button>
  );
}

function TextFillToggleButton(props: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="canvagent-style-fill-toggle"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      <span className={`canvagent-style-fill-toggle-inner ${props.active ? 'is-active' : ''}`}>
        T
      </span>
    </button>
  );
}

function StrokeWidthControl(props: {
  color: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const safeValue = clamp(props.value, props.min, props.max);
  const trackLeft = 20;
  const trackRight = 90;
  const trackWidth = trackRight - trackLeft;
  const normalizedValue = props.max <= props.min ? 0 : (safeValue - props.min) / (props.max - props.min);
  const thumbLeft = props.max <= props.min ? trackLeft : trackLeft + normalizedValue * trackWidth;
  const progressWidth = Math.max(0, thumbLeft - trackLeft);
  const dotStyle = props.color === '#ffffff'
    ? { backgroundColor: props.color, boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.55)' }
    : { backgroundColor: props.color };

  return (
    <div className="canvagent-style-width-control">
      <div className="canvagent-style-width-track">
        <input
          className="canvagent-style-width-input"
          type="range"
          min={props.min}
          max={props.max}
          step={0.1}
          aria-label="Line width"
          value={safeValue}
          onChange={(event) => props.onChange(Number(event.target.value))}
        />
        <div
          className="canvagent-style-width-rail"
          style={{ left: `${trackLeft}px`, width: `${trackWidth}px` }}
        />
        <div
          className="canvagent-style-width-progress"
          style={{ left: `${trackLeft}px`, width: `${progressWidth}px` }}
        />
        <span className="canvagent-style-width-dot is-small" style={dotStyle} />
        <span className="canvagent-style-width-dot is-large" style={dotStyle} />
        <span
          className="canvagent-style-width-thumb"
          style={{ left: `${thumbLeft}px` }}
        />
      </div>
    </div>
  );
}

function AnnotationHitTarget(props: {
  annotation: WorkspaceAnnotation;
  imageLayout: { x: number; y: number; width: number; height: number; scale: number };
  selected: boolean;
  tool?: AnnotationTool;
  onSelect: () => void;
  onOpenTextEditor?: () => void;
}) {
  const bounds = getAnnotationBounds(props.annotation);
  const showSelectedState = props.selected && props.tool !== 'pan';

  return (
    <button
      type="button"
      className={`canvagent-stage-dom-hit-target ${showSelectedState ? 'is-selected' : ''}`}
      aria-label={`Select annotation ${props.annotation.id}`}
      style={{
        left: `${props.imageLayout.x + bounds.x * props.imageLayout.scale}px`,
        top: `${props.imageLayout.y + bounds.y * props.imageLayout.scale}px`,
        width: `${Math.max(18, bounds.width * props.imageLayout.scale)}px`,
        height: `${Math.max(18, bounds.height * props.imageLayout.scale)}px`,
      }}
      onClick={(event) => {
        event.stopPropagation();
        props.onSelect();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        props.onOpenTextEditor?.();
      }}
    />
  );
}

function ResizeHandleOverlay(props: {
  annotation: WorkspaceAnnotation;
  imageLayout: { x: number; y: number; width: number; height: number; scale: number };
  onResizeStart?: (handle: ResizeHandlePosition) => void;
}) {
  const bounds = getAnnotationBounds(props.annotation);
  const handles = getResizeHandlePositions(bounds);

  return (
    <>
      {handles.map((handle) => (
        <button
          key={handle.name}
          type="button"
          aria-label={`Resize ${handle.name}`}
          className="canvagent-stage-dom-resize-handle"
          style={{
            left: `${props.imageLayout.x + handle.x * props.imageLayout.scale}px`,
            top: `${props.imageLayout.y + handle.y * props.imageLayout.scale}px`,
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
            props.onResizeStart?.(handle.name);
          }}
        />
      ))}
    </>
  );
}

function getToolStyleKind(tool: AnnotationTool): StyleKind | null {
  if (tool === 'pan') {
    return null;
  }

  if (tool === 'rectangle') {
    return 'rectangle';
  }

  return tool;
}

function getAnnotationStyleKind(annotation: WorkspaceAnnotation): StyleKind {
  if (annotation.type === 'rect') {
    return 'rectangle';
  }

  if (annotation.type === 'highlight') {
    return 'brush';
  }

  return annotation.type;
}

function getShapeTool(tool: AnnotationTool) {
  if (tool === 'rectangle') return 'rectangle';
  if (tool === 'ellipse') return 'ellipse';
  if (tool === 'arrow') return 'arrow';
  if (tool === 'brush') return 'brush';
  return null;
}

function isTransformable(annotation: WorkspaceAnnotation | null) {
  return annotation?.type === 'rect' || annotation?.type === 'ellipse' || annotation?.type === 'text';
}

function isStrokeAnnotation(annotation: WorkspaceAnnotation | null): annotation is Exclude<WorkspaceAnnotation, Extract<WorkspaceAnnotation, { type: 'text' }>> {
  return !!annotation && annotation.type !== 'text';
}

function isDrawableAnnotation(annotation: WorkspaceAnnotation) {
  if (annotation.type === 'brush' || annotation.type === 'highlight') {
    return annotation.geometry.points.length >= 4;
  }

  if (annotation.type === 'arrow') {
    const [x1, y1, x2, y2] = annotation.geometry.points;
    return Math.abs(x2 - x1) >= MIN_SHAPE_SIZE || Math.abs(y2 - y1) >= MIN_SHAPE_SIZE;
  }

  if (annotation.type === 'text') {
    return annotation.text.trim().length > 0;
  }

  if (annotation.type === 'rect' || annotation.type === 'ellipse') {
    return annotation.geometry.width >= MIN_SHAPE_SIZE || annotation.geometry.height >= MIN_SHAPE_SIZE;
  }

  return false;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

function getStrokeColor(annotation: WorkspaceAnnotation) {
  return String(annotation.style?.stroke ?? (annotation.type === 'brush' ? BRUSH_STROKE : SHAPE_STROKE));
}

function getStrokeWidth(annotation: WorkspaceAnnotation) {
  return Number(annotation.style?.strokeWidth ?? (annotation.type === 'brush' ? BRUSH_STROKE_WIDTH : SHAPE_STROKE_WIDTH));
}

function getTextColor(value: WorkspaceAnnotation | TextStyleValue | TextEditorState) {
  const style = 'style' in value ? value.style : undefined;
  return String(style?.color ?? ('color' in value ? value.color : undefined) ?? TEXT_COLOR);
}

function getTextFontSize(value: WorkspaceAnnotation | TextStyleValue | TextEditorState) {
  const style = 'style' in value ? value.style : undefined;
  return Number(style?.fontSize ?? ('fontSize' in value ? value.fontSize : undefined) ?? TEXT_SIZE);
}

function getTextFill(value: WorkspaceAnnotation | TextStyleValue | TextEditorState) {
  const style = 'style' in value ? value.style : undefined;
  return String(style?.fill ?? ('fill' in value ? value.fill : undefined) ?? '#ffffff');
}

function getTextFillEnabled(value: WorkspaceAnnotation | TextStyleValue | TextEditorState) {
  const style = 'style' in value ? value.style : undefined;
  return Boolean(style?.fillEnabled ?? ('fillEnabled' in value ? value.fillEnabled : undefined) ?? false);
}

function getTextStyle(value: WorkspaceAnnotation | TextStyleValue | TextEditorState): TextStyleValue {
  return {
    color: getTextColor(value),
    fontSize: getTextFontSize(value),
    fill: getTextFill(value),
    fillEnabled: getTextFillEnabled(value),
  };
}

function getStrokeStyle(annotation: WorkspaceAnnotation): StrokeStyleValue {
  return {
    stroke: getStrokeColor(annotation),
    strokeWidth: getStrokeWidth(annotation),
  };
}

function getReadableTextColor(background: string) {
  const normalized = background.replace('#', '');
  const safeHex = normalized.length === 3
    ? normalized.split('').map((value) => value + value).join('')
    : normalized;
  const red = Number.parseInt(safeHex.slice(0, 2), 16);
  const green = Number.parseInt(safeHex.slice(2, 4), 16);
  const blue = Number.parseInt(safeHex.slice(4, 6), 16);
  const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
  return luminance > 0.6 ? '#111827' : '#ffffff';
}

function getEffectiveTextColor(value: TextStyleValue | TextEditorState) {
  return value.fillEnabled ? getReadableTextColor(value.fill) : value.color;
}

function resolveNextTextStyle(previous: TextStyleValue, patch: Partial<TextStyleValue>): TextStyleValue {
  const nextColor = patch.color ?? previous.color;
  const nextFillEnabled = patch.fillEnabled ?? previous.fillEnabled;
  const nextFill = patch.fill
    ?? (
      patch.fillEnabled === true && previous.fillEnabled === false
        ? buildTextFill(previous.color)
        : patch.color !== undefined && nextFillEnabled
          ? buildTextFill(nextColor)
          : previous.fill
    );

  return {
    ...previous,
    ...patch,
    color: nextColor,
    fillEnabled: nextFillEnabled,
    fill: nextFill,
  };
}

let textMeasureContext: CanvasRenderingContext2D | null | undefined;

function getTextMeasureContext() {
  if (textMeasureContext !== undefined) {
    return textMeasureContext;
  }

  if (typeof document === 'undefined' || IS_JSDOM) {
    textMeasureContext = null;
    return textMeasureContext;
  }

  const canvas = document.createElement('canvas');
  try {
    textMeasureContext = canvas.getContext('2d');
  } catch {
    textMeasureContext = null;
  }
  return textMeasureContext;
}

function measureTextBounds(text: string, fontSize = TEXT_SIZE) {
  const safeText = text || ' ';
  const lines = safeText.split('\n');
  const lineHeight = Math.round(fontSize * 1.28);
  const context = getTextMeasureContext();

  if (!context) {
    const estimatedWidth = Math.max(
      Math.round(fontSize * 0.8),
      ...lines.map((line) => Math.round(Math.max(1, line.length) * fontSize * 0.62)),
    );

    return {
      width: estimatedWidth,
      height: Math.max(lineHeight, lines.length * lineHeight),
      lineHeight,
    };
  }

  context.font = `700 ${fontSize}px sans-serif`;
  const width = Math.max(
    Math.round(fontSize * 0.8),
    ...lines.map((line) => Math.ceil(context.measureText(line || ' ').width)),
  );

  return {
    width,
    height: Math.max(lineHeight, lines.length * lineHeight),
    lineHeight,
  };
}

function getAnnotationBounds(annotation: WorkspaceAnnotation): AnnotationBounds {
  if (annotation.type === 'brush' || annotation.type === 'highlight') {
    return getPointsBounds(annotation.geometry.points);
  }

  if (annotation.type === 'arrow') {
    return getPointsBounds(annotation.geometry.points);
  }

  if (annotation.type === 'text') {
    const { width, height } = measureTextBounds(annotation.text, getTextFontSize(annotation));
    return {
      x: annotation.geometry.x - 8,
      y: annotation.geometry.y - 6,
      width: width + 16,
      height: height + 12,
    };
  }

  if (annotation.type === 'rect' || annotation.type === 'ellipse') {
    return {
      x: annotation.geometry.x,
      y: annotation.geometry.y,
      width: Math.max(1, annotation.geometry.width),
      height: Math.max(1, annotation.geometry.height),
    };
  }

  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };
}

function getPointsBounds(points: number[]): AnnotationBounds {
  const xs: number[] = [];
  const ys: number[] = [];

  for (let index = 0; index < points.length; index += 2) {
    xs.push(points[index]!);
    ys.push(points[index + 1]!);
  }

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
  };
}

function getResizeHandlePositions(bounds: AnnotationBounds) {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return [
    { name: 'top-left', x: bounds.x, y: bounds.y },
    { name: 'top-center', x: centerX, y: bounds.y },
    { name: 'top-right', x: bounds.x + bounds.width, y: bounds.y },
    { name: 'middle-left', x: bounds.x, y: centerY },
    { name: 'middle-right', x: bounds.x + bounds.width, y: centerY },
    { name: 'bottom-left', x: bounds.x, y: bounds.y + bounds.height },
    { name: 'bottom-center', x: centerX, y: bounds.y + bounds.height },
    { name: 'bottom-right', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  ] satisfies Array<{ name: ResizeHandlePosition; x: number; y: number }>;
}

function hasNodeName(node: any, name: string) {
  const nodeName = typeof node?.name === 'function' ? node.name() : '';
  return String(nodeName)
    .split(' ')
    .filter(Boolean)
    .includes(name);
}

function isTransformerTarget(node: any) {
  return Boolean(node?.findAncestor?.('Transformer', true));
}

function isAnnotationTarget(node: any) {
  let currentNode = node;
  while (currentNode) {
    if (hasNodeName(currentNode, 'annotation-shape')) {
      return true;
    }
    currentNode = currentNode.getParent?.() ?? null;
  }
  return false;
}

function getTransformerCursor(node: any): string | null {
  if (!node || !isTransformerTarget(node)) return null;
  const nodeName = typeof node.name === 'function' ? String(node.name()) : '';
  if (nodeName.includes('top-left') || nodeName.includes('bottom-right')) {
    return 'nwse-resize';
  }
  if (nodeName.includes('top-right') || nodeName.includes('bottom-left')) {
    return 'nesw-resize';
  }
  if (nodeName.includes('top-center') || nodeName.includes('bottom-center')) {
    return 'ns-resize';
  }
  if (nodeName.includes('middle-left') || nodeName.includes('middle-right')) {
    return 'ew-resize';
  }
  return 'move';
}

function getArrowEndpointCursor(points: [number, number, number, number]) {
  const [x1, y1, x2, y2] = points;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const normalized = Math.abs((angle * 180) / Math.PI);
  if (normalized <= 22.5 || normalized >= 157.5) {
    return 'ew-resize';
  }
  if (normalized >= 67.5 && normalized <= 112.5) {
    return 'ns-resize';
  }
  return normalized < 90 ? 'nwse-resize' : 'nesw-resize';
}

function getArrowEndpointHoverCursor(node: any): string | null {
  if (!node || !hasNodeName(node, 'arrow-endpoint')) return null;
  const endpointCursor = node.getAttr?.('endpointCursor');
  return typeof endpointCursor === 'string' ? endpointCursor : null;
}

function getImagePoint(
  event: MouseEvent<HTMLDivElement>,
  imageLayout: { x: number; y: number; width: number; height: number; scale: number },
  requireWithinImage = false,
) {
  const rect = event.currentTarget.getBoundingClientRect();
  return getImagePointFromClientPosition(event.clientX, event.clientY, rect, imageLayout, requireWithinImage);
}

function getImagePointFromClientPosition(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  imageLayout: { x: number; y: number; width: number; height: number; scale: number },
  requireWithinImage = false,
) {

  if (rect.width === 0 || rect.height === 0) {
    return {
      x: imageLayout.width / imageLayout.scale / 2,
      y: imageLayout.height / imageLayout.scale / 2,
    };
  }

  const localX = clientX - rect.left;
  const localY = clientY - rect.top;

  const withinImage = (
    localX >= imageLayout.x
    && localX <= imageLayout.x + imageLayout.width
    && localY >= imageLayout.y
    && localY <= imageLayout.y + imageLayout.height
  );

  if (requireWithinImage && !withinImage) {
    return null;
  }

  return {
    x: Math.max(0, Math.min((localX - imageLayout.x) / imageLayout.scale, imageLayout.width / imageLayout.scale)),
    y: Math.max(0, Math.min((localY - imageLayout.y) / imageLayout.scale, imageLayout.height / imageLayout.scale)),
  };
}

function getResizedGeometryFromHandle(
  geometry: { x: number; y: number; width: number; height: number },
  handle: ResizeHandlePosition,
  point: { x: number; y: number },
) {
  const left = geometry.x;
  const top = geometry.y;
  const right = geometry.x + geometry.width;
  const bottom = geometry.y + geometry.height;

  const nextLeft = handle.includes('left')
    ? Math.min(point.x, right - MIN_SHAPE_SIZE)
    : left;
  const nextRight = handle.includes('right')
    ? Math.max(point.x, left + MIN_SHAPE_SIZE)
    : right;
  const nextTop = handle.includes('top')
    ? Math.min(point.y, bottom - MIN_SHAPE_SIZE)
    : top;
  const nextBottom = handle.includes('bottom')
    ? Math.max(point.y, top + MIN_SHAPE_SIZE)
    : bottom;

  return {
    x: nextLeft,
    y: nextTop,
    width: Math.max(MIN_SHAPE_SIZE, nextRight - nextLeft),
    height: Math.max(MIN_SHAPE_SIZE, nextBottom - nextTop),
  };
}
